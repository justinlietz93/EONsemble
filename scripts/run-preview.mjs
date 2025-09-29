#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PREVIEW_ENV_VARS } from './preview-env-constants.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '..')

const persistencePort =
  process.env[PREVIEW_ENV_VARS.PERSISTENCE_PORT] ||
  process.env[PREVIEW_ENV_VARS.LEGACY_PERSISTENCE_PORT] ||
  '4000'
const previewEnv = { ...process.env }

if (!previewEnv[PREVIEW_ENV_VARS.PERSISTENCE_PORT]) {
  previewEnv[PREVIEW_ENV_VARS.PERSISTENCE_PORT] = persistencePort
}

if (!previewEnv[PREVIEW_ENV_VARS.PERSISTENCE_URL]) {
  previewEnv[PREVIEW_ENV_VARS.PERSISTENCE_URL] = `http://localhost:${persistencePort}`
}

const skipViteRaw = process.env[PREVIEW_ENV_VARS.SKIP_VITE]
const skipVitePreview = typeof skipViteRaw === 'string'
  ? ['1', 'true', 'yes'].includes(skipViteRaw.toLowerCase())
  : false

const persistenceBaseUrl = previewEnv[PREVIEW_ENV_VARS.PERSISTENCE_URL]
let healthCheckUrl

try {
  healthCheckUrl = new URL('/api/state/__healthcheck', persistenceBaseUrl).toString()
} catch {
  healthCheckUrl = `http://localhost:${persistencePort}/api/state/__healthcheck`
}

const MAX_WAIT_MS = 30000
const POLL_INTERVAL_MS = 250
const REQUEST_TIMEOUT_MS = 2000

const serverProcess = spawn(process.execPath, [resolve(projectRoot, 'server', 'index.cjs')], {
  cwd: projectRoot,
  env: {
    ...process.env,
    PORT: persistencePort,
    [PREVIEW_ENV_VARS.PERSISTENCE_PORT]: persistencePort
  },
  stdio: 'inherit'
})

let previewProcess
let shuttingDown = false

const terminate = (code = 0) => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true

  if (previewProcess && previewProcess.exitCode === null) {
    previewProcess.kill('SIGTERM')
  }

  if (serverProcess.exitCode === null) {
    serverProcess.kill('SIGTERM')
  }

  setTimeout(() => {
    process.exit(code)
  }, 100)
}

const spawnPreview = () => {
  if (skipVitePreview) {
    return
  }

  if (serverProcess.exitCode !== null) {
    if (serverProcess.exitCode !== 0) {
      console.error(`Persistence server exited with code ${serverProcess.exitCode}`)
      process.exit(serverProcess.exitCode)
    }
    return
  }

  const viteBin = process.platform === 'win32'
    ? resolve(projectRoot, 'node_modules', '.bin', 'vite.cmd')
    : resolve(projectRoot, 'node_modules', '.bin', 'vite')

  previewProcess = spawn(viteBin, ['preview', '--host'], {
    cwd: projectRoot,
    env: previewEnv,
    stdio: 'inherit'
  })

  previewProcess.on('exit', code => {
    if (!shuttingDown) {
      terminate(code ?? 0)
    }
  })

  previewProcess.on('error', error => {
    console.error('Failed to launch Vite preview', error)
    terminate(1)
  })
}

const waitForPersistenceReady = async () => {
  const deadline = Date.now() + MAX_WAIT_MS

  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error('Persistence server exited before it became ready')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      await fetch(healthCheckUrl, { cache: 'no-store', signal: controller.signal })
      return
    } catch (error) {
      const connectionCode = error?.cause?.code || error.code
      if (error.name !== 'AbortError' && connectionCode !== 'ECONNREFUSED' && connectionCode !== 'ECONNRESET') {
        console.warn('Waiting for persistence server:', error.message)
      }
    } finally {
      clearTimeout(timeout)
    }

    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error(`Persistence server did not become ready within ${Math.round(MAX_WAIT_MS / 1000)} seconds`)
}

serverProcess.on('exit', code => {
  if (!shuttingDown) {
    if (code && code !== 0) {
      console.error(`Persistence server exited with code ${code}`)
      terminate(code)
    } else {
      terminate(0)
    }
  }
})

serverProcess.on('error', error => {
  console.error('Failed to launch persistence server', error)
  terminate(1)
})

process.on('SIGINT', () => {
  terminate(0)
})

process.on('SIGTERM', () => {
  terminate(0)
})

const bootstrap = async () => {
  try {
    await waitForPersistenceReady()

    if (skipVitePreview) {
      console.log(
        `Persistence server ready at ${persistenceBaseUrl} (skipping Vite preview launch)`
      )
      return
    }

    spawnPreview()
  } catch (error) {
    console.error('Failed to start preview environment:', error.message)
    terminate(1)
  }
}

bootstrap()
