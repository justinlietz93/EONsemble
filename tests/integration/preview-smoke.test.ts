import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

import { PREVIEW_ENV_VARS } from '../../scripts/preview-env-constants.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '..', '..')

const getAvailablePort = async (): Promise<number> =>
  await new Promise((resolvePort, rejectPort) => {
    const server = createServer()
    server.unref()

    server.on('error', error => {
      server.close(() => rejectPort(error))
    })

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()

      if (address && typeof address === 'object') {
        const { port } = address
        server.close(() => resolvePort(port))
        return
      }

      server.close(() => rejectPort(new Error('Failed to acquire a free port')))
    })
  })

const waitForHealthcheck = async (url: string, timeoutMs = 30000, intervalMs = 250) => {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = undefined

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: 'no-store' })

      if (response.ok) {
        return
      }

      lastError = new Error(`Received status ${response.status}`)
    } catch (error) {
      lastError = error
    }

    await sleep(intervalMs)
  }

  const message = lastError instanceof Error ? lastError.message : 'unknown error'
  throw new Error(`Timed out waiting for ${url}: ${message}`)
}

const waitForProcessExit = async (child: ReturnType<typeof spawn>, timeoutMs = 10000) => {
  if (child.exitCode !== null || child.signalCode) {
    return { code: child.exitCode, signal: child.signalCode }
  }

  return await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveExit, rejectExit) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      rejectExit(new Error('Preview orchestrator did not exit before timeout'))
    }, timeoutMs)

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timer)
      resolveExit({ code, signal })
    }

    const onError = (error: Error) => {
      clearTimeout(timer)
      rejectExit(error)
    }

    child.once('exit', onExit)
    child.once('error', onError)
  })
}

describe('preview orchestrator smoke test', () => {
  test('npm run preview bootstraps persistence and the OpenAI catalog', async () => {
    const port = await getAvailablePort()
    const persistenceUrl = `http://127.0.0.1:${port}`
    const dataDir = await mkdtemp(join(tmpdir(), 'preview-smoke-'))
    const previewScript = resolve(projectRoot, 'scripts', 'run-preview.mjs')

    const orchestrator = spawn(process.execPath, [previewScript], {
      cwd: projectRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        [PREVIEW_ENV_VARS.SKIP_VITE]: '1',
        [PREVIEW_ENV_VARS.PERSISTENCE_PORT]: String(port),
        [PREVIEW_ENV_VARS.PERSISTENCE_URL]: persistenceUrl,
        [PREVIEW_ENV_VARS.DATA_DIR]: dataDir
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    orchestrator.stdout?.setEncoding('utf8')
    orchestrator.stderr?.setEncoding('utf8')
    const output: string[] = []

    orchestrator.stdout?.on('data', chunk => {
      output.push(chunk.toString())
    })
    orchestrator.stderr?.on('data', chunk => {
      output.push(chunk.toString())
    })

    let ready = false
    let exitHandler: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined
    const prematureExit = new Promise<never>((_, reject) => {
      exitHandler = (code, signal) => {
        if (!ready) {
          const logs = output.join('').trim()
          const suffix = logs.length > 0 ? `\nProcess output:\n${logs}` : ''
          reject(new Error(`Preview orchestrator exited before readiness (code ${code ?? 'null'}${signal ? `, signal ${signal}` : ''})${suffix}`))
        }
      }

      orchestrator.on('exit', exitHandler)
    })

    let testError: unknown = undefined
    let cleanupError: unknown = undefined

    try {
      await Promise.race([
        waitForHealthcheck(`${persistenceUrl}/api/state/__healthcheck`),
        prematureExit
      ])
      ready = true

      const persistedValue = { message: 'preview-smoke', timestamp: Date.now() }
      const storageKey = 'vitest-preview-smoke'

      const putResponse = await fetch(`${persistenceUrl}/api/state/${storageKey}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: persistedValue })
      })

      expect(putResponse.status).toBe(200)
      const putPayload = await putResponse.json()
      expect(putPayload).toEqual({ value: persistedValue })

      const getResponse = await fetch(`${persistenceUrl}/api/state/${storageKey}`, {
        cache: 'no-store'
      })

      expect(getResponse.status).toBe(200)
      const getPayload = await getResponse.json()
      expect(getPayload).toEqual({ value: persistedValue })

      const catalogResponse = await fetch(`${persistenceUrl}/api/openai/models`, {
        cache: 'no-store'
      })

      expect(catalogResponse.status).toBe(200)
      const catalog = await catalogResponse.json()

      expect(catalog).toMatchObject({ provider: 'openai' })
      expect(Array.isArray(catalog?.models)).toBe(true)
      expect(catalog.models.length).toBeGreaterThan(0)
    } catch (error) {
      testError = error
    } finally {
      if (exitHandler) {
        orchestrator.off('exit', exitHandler)
      }

      if (orchestrator.exitCode === null && !orchestrator.killed) {
        orchestrator.kill('SIGTERM')
      }

      await waitForProcessExit(orchestrator).catch(error => {
        cleanupError = error
      })

      await rm(dataDir, { recursive: true, force: true }).catch(() => undefined)
    }

    if (testError) {
      throw testError
    }

    if (cleanupError) {
      throw cleanupError
    }
  }, 60000)
})
