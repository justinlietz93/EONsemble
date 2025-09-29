import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'

type MockChildProcess = EventEmitter & {
  stdout: EventEmitter & { setEncoding: ReturnType<typeof vi.fn> }
  stderr: EventEmitter & { setEncoding: ReturnType<typeof vi.fn> }
  stdin: EventEmitter & {
    write: ReturnType<typeof vi.fn>
    end: ReturnType<typeof vi.fn>
  }
  kill: ReturnType<typeof vi.fn>
  exitCode: number | null
}

const pythonEnvKeys = ['PYTHON_EXECUTABLE', 'PYTHON_BIN', 'PYTHON', 'PYENV_PYTHON', 'VIRTUAL_ENV'] as const

const originalEnv: Record<(typeof pythonEnvKeys)[number], string | undefined> = Object.fromEntries(
  pythonEnvKeys.map(key => [key, process.env[key]])
) as Record<(typeof pythonEnvKeys)[number], string | undefined>

const resetPythonEnv = () => {
  for (const key of pythonEnvKeys) {
    delete process.env[key]
  }
}

const restorePythonEnv = () => {
  for (const key of pythonEnvKeys) {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

const createMockChildProcess = (): MockChildProcess => {
  const stdout = Object.assign(new EventEmitter(), { setEncoding: vi.fn(() => undefined) })
  const stderr = Object.assign(new EventEmitter(), { setEncoding: vi.fn(() => undefined) })
  const stdin = Object.assign(new EventEmitter(), {
    write: vi.fn((_: string, callback?: (error?: Error | null) => void) => {
      if (callback) {
        callback(null)
      }
      return true
    }),
    end: vi.fn(() => undefined)
  })

  const child = Object.assign(new EventEmitter(), {
    stdout,
    stderr,
    stdin,
    kill: vi.fn(() => undefined),
    exitCode: null as number | null
  }) as MockChildProcess

  child.on('close', code => {
    child.exitCode = code ?? 0
  })

  return child
}

const importPythonBridgeWithMocks = async <T>(
  overrides: { spawn: ReturnType<typeof vi.fn>; spawnSync: ReturnType<typeof vi.fn> },
  callback: (module: typeof import('../../server/python-bridge.cjs')) => Promise<T>
) => {
  const moduleModule = await import('node:module')
  const originalLoad = moduleModule.Module._load

  moduleModule.Module._load = function (request: string, parent: unknown, isMain: boolean) {
    if (request === 'child_process') {
      return overrides
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    vi.resetModules()
    const bridgeModule = await import('../../server/python-bridge.cjs')
    return await callback(bridgeModule)
  } finally {
    moduleModule.Module._load = originalLoad
  }
}

describe('python bridge', () => {
  let warnSpy: ReturnType<typeof vi.spyOn> | null = null

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterAll(() => {
    restorePythonEnv()
  })

  afterEach(async () => {
    vi.resetModules()
    resetPythonEnv()
    if (warnSpy) {
      warnSpy.mockRestore()
      warnSpy = null
    }
  })

  it('rejects when a Python interpreter cannot be resolved', async () => {
    vi.resetModules()
    resetPythonEnv()

    const spawnMock = vi.fn(() => createMockChildProcess())
    const spawnSyncMock = vi.fn(() => ({ error: new Error('not found'), status: 1 }))

    await importPythonBridgeWithMocks({ spawn: spawnMock, spawnSync: spawnSyncMock }, async ({ runVoidManager, shutdownWorker }) => {
      await expect(runVoidManager({ command: 'status' })).rejects.toThrow(/Python interpreter not found/)
      await shutdownWorker()
    })

    expect(spawnSyncMock).toHaveBeenCalled()
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('executes the Void manager and returns parsed JSON output', async () => {
    vi.resetModules()
    resetPythonEnv()
    process.env.PYTHON_EXECUTABLE = 'python-test'

    let childProcessInstance: MockChildProcess | null = null

    const spawnMock = vi.fn(() => {
      childProcessInstance = createMockChildProcess()
      return childProcessInstance
    })

    const spawnSyncMock = vi.fn((command: string) => {
      if (command === 'python-test') {
        return { status: 0, stdout: 'Python 3.11.0\n', stderr: '' }
      }
      return { error: new Error('unexpected'), status: 1, stdout: '', stderr: 'unexpected' }
    })

    await importPythonBridgeWithMocks({ spawn: spawnMock, spawnSync: spawnSyncMock }, async ({ runVoidManager, shutdownWorker }) => {
      const payload = { action: 'ping', command: 'register', config: {} }
      const resultPromise = runVoidManager(payload)

      expect(childProcessInstance).not.toBeNull()
      const child = childProcessInstance as MockChildProcess

      expect(child.stdin.write).toHaveBeenCalledWith(`${JSON.stringify(payload)}\n`, expect.any(Function))

      child.stdout.emit('data', '\n{ "ok": true }\n')

      await expect(resultPromise).resolves.toEqual({ ok: true })

      const shutdownPromise = shutdownWorker()
      child.emit('exit', 0)
      child.emit('close', 0)
      await shutdownPromise
    })

    expect(spawnMock).toHaveBeenCalledWith('python-test', expect.any(Array), expect.objectContaining({ env: expect.any(Object) }))
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'python-test',
      ['--version'],
      expect.objectContaining({ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    )
  })

  it('propagates errors reported by the Void manager process', async () => {
    vi.resetModules()
    resetPythonEnv()
    process.env.PYTHON_EXECUTABLE = 'python-test'

    let childProcessInstance: MockChildProcess | null = null

    const spawnMock = vi.fn(() => {
      childProcessInstance = createMockChildProcess()
      return childProcessInstance
    })

    const spawnSyncMock = vi.fn(() => ({ status: 0, stdout: 'Python 3.11.0\n', stderr: '' }))

    await importPythonBridgeWithMocks({ spawn: spawnMock, spawnSync: spawnSyncMock }, async ({ runVoidManager, shutdownWorker }) => {
      const payload = { action: 'fail', command: 'register', config: {} }
      const resultPromise = runVoidManager(payload)

      expect(childProcessInstance).not.toBeNull()
      const child = childProcessInstance as MockChildProcess

      child.stdout.emit('data', `${JSON.stringify({ error: 'manager exploded' })}\n`)

      await expect(resultPromise).rejects.toThrow('manager exploded')
      expect(child.kill).not.toHaveBeenCalled()

      const shutdownPromise = shutdownWorker()
      child.emit('exit', 1)
      child.emit('close', 1)
      await shutdownPromise
    })

    expect(spawnMock).toHaveBeenCalledWith('python-test', expect.any(Array), expect.objectContaining({ env: expect.any(Object) }))
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'python-test',
      ['--version'],
      expect.objectContaining({ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    )
  })

  it('reuses a persistent Python worker for sequential requests', async () => {
    vi.resetModules()
    resetPythonEnv()
    process.env.PYTHON_EXECUTABLE = 'python-test'

    const child = createMockChildProcess()

    const spawnMock = vi.fn(() => child)
    const spawnSyncMock = vi.fn(() => ({ status: 0, stdout: 'Python 3.11.0\n', stderr: '' }))

    await importPythonBridgeWithMocks({ spawn: spawnMock, spawnSync: spawnSyncMock }, async ({ runVoidManager, shutdownWorker }) => {
      const firstPromise = runVoidManager({ command: 'register', config: {}, payload: 1 })
      const secondPromise = runVoidManager({ command: 'register', config: {}, payload: 2 })

      child.stdout.emit('data', `${JSON.stringify({ first: true })}\n`)
      await expect(firstPromise).resolves.toEqual({ first: true })

      child.stdout.emit('data', `${JSON.stringify({ second: true })}\n`)
      await expect(secondPromise).resolves.toEqual({ second: true })

      expect(spawnMock).toHaveBeenCalledTimes(1)
      expect(child.stdin.write).toHaveBeenCalledTimes(2)

      const shutdownPromise = shutdownWorker()
      child.emit('exit', 0)
      child.emit('close', 0)
      await shutdownPromise
    })
  })
})
