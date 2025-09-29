const path = require('path')
const { spawn, spawnSync } = require('child_process')
const { once } = require('events')

const SHUTDOWN_COMMAND = '__shutdown__'
let shutdownHooksRegistered = false
let exitHandler = null
let sigintHandler = null
let sigtermHandler = null

const { REPO_ROOT, VOID_SCRIPT, VOID_STATE_FILE } = require('./constants.cjs')

const MIN_PYTHON_MAJOR = 3
const MIN_PYTHON_MINOR = 10
const UNSAFE_EXECUTABLE_PATTERN = /[|&;<>`$\r\n\0]/

const isSafeExecutablePath = candidate => {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    return false
  }

  if (UNSAFE_EXECUTABLE_PATTERN.test(candidate) || candidate.includes('"') || candidate.includes("'")) {
    return false
  }

  return true
}

const parsePythonVersion = output => {
  if (!output || typeof output !== 'string') {
    return null
  }

  const match = output.match(/Python\s+(\d+)(?:\.(\d+))?(?:\.(\d+))?/i)
  if (!match) {
    return null
  }

  const [, major, minor = '0', patch = '0'] = match
  return {
    major: Number.parseInt(major, 10),
    minor: Number.parseInt(minor, 10),
    patch: Number.parseInt(patch, 10)
  }
}

const isSupportedPythonVersion = version => {
  if (!version || Number.isNaN(version.major) || Number.isNaN(version.minor)) {
    return false
  }

  if (version.major > MIN_PYTHON_MAJOR) {
    return true
  }

  if (version.major === MIN_PYTHON_MAJOR) {
    return version.minor >= MIN_PYTHON_MINOR
  }

  return false
}

const createPythonCandidateList = () => {
  const candidates = new Set()

  const addCandidate = value => {
    if (!value || typeof value !== 'string') {
      return
    }

    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return
    }

    candidates.add(trimmed)
  }

  addCandidate(process.env.PYTHON_EXECUTABLE)
  addCandidate(process.env.PYTHON_BIN)
  addCandidate(process.env.PYTHON)
  addCandidate(process.env.PYENV_PYTHON)

  if (process.env.VIRTUAL_ENV) {
    const virtualEnv = process.env.VIRTUAL_ENV
    addCandidate(path.join(virtualEnv, 'bin', 'python'))
    addCandidate(path.join(virtualEnv, 'Scripts', 'python.exe'))
  }

  if (process.platform === 'win32') {
    addCandidate('py')
    addCandidate('python3')
    addCandidate('python')
  } else {
    addCandidate('python3')
    addCandidate('python')
  }

  return Array.from(candidates).filter(isSafeExecutablePath)
}

const resolvePythonExecutable = () => {
  for (const candidate of PYTHON_CANDIDATES) {
    try {
      // spawnSync is invoked with shell:false (the default) and the candidate
      // list is sanitized above, preventing command injection.
      const result = spawnSync(candidate, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      })

      if (result.error || result.status !== 0) {
        continue
      }

      const versionOutput = (result.stdout || result.stderr || '').trim()
      const version = parsePythonVersion(versionOutput)

      if (isSupportedPythonVersion(version)) {
        return candidate
      }
    } catch {
      // Ignore resolution failures and continue to the next candidate.
    }
  }

  return null
}

const PYTHON_CANDIDATES = createPythonCandidateList()
const PYTHON_EXECUTABLE = resolvePythonExecutable()

if (!PYTHON_EXECUTABLE) {
  console.warn(
    'Unable to locate a Python interpreter. The Void manager bridge will fail until Python is installed or the PYTHON/PYTHON_EXECUTABLE environment variable is set.',
    { candidates: PYTHON_CANDIDATES }
  )
}

class VoidManagerWorker {
  constructor() {
    this.child = null
    this.stdoutBuffer = ''
    this.stderrBuffer = ''
    this.activeRequest = null
    this.queue = []
    this.shuttingDown = false
  }

  ensureProcess() {
    if (this.child && this.child.exitCode === null) {
      return
    }

    this.spawnProcess()
  }

  spawnProcess() {
    if (!PYTHON_EXECUTABLE) {
      throw new Error(
        `Python interpreter not found. Install Python 3.10+ or set PYTHON/PYTHON_EXECUTABLE (checked: ${
          PYTHON_CANDIDATES.join(', ') || 'none'
        })`
      )
    }

    const args = [VOID_SCRIPT, VOID_STATE_FILE]
    const child = spawn(PYTHON_EXECUTABLE, args, {
      cwd: REPO_ROOT,
      env: { ...process.env, PYTHONPATH: REPO_ROOT },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    this.child = child
    this.stdoutBuffer = ''
    this.stderrBuffer = ''
    this.shuttingDown = false

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      this.stdoutBuffer += chunk
      this.drainStdout()
    })

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      this.stderrBuffer += chunk
    })

    child.on('close', code => {
      const errorMessage = this.createExitMessage(code)
      const error = errorMessage ? new Error(errorMessage) : null
      this.handleProcessTermination(error)
    })

    child.on('error', error => {
      this.handleProcessTermination(new Error(`Failed to execute Void manager process: ${error.message}`))
    })

    child.stdin.on('error', error => {
      this.handleProcessTermination(new Error(`Failed to communicate with Void manager: ${error.message}`))
    })
  }

  createExitMessage(code) {
    if (this.shuttingDown) {
      return null
    }

    if (code && code !== 0) {
      return this.stderrBuffer.trim() || this.stdoutBuffer.trim() || `Void manager exited with code ${code}`
    }

    if (code === 0 && (this.stdoutBuffer.length > 0 || this.stderrBuffer.length > 0)) {
      const message = this.stderrBuffer.trim() || this.stdoutBuffer.trim()
      if (message) {
        return message
      }
    }

    return code === 0 ? 'Void manager worker exited unexpectedly' : null
  }

  handleProcessTermination(error) {
    if (this.child) {
      this.child.removeAllListeners()
    }

    const hadActiveRequest = Boolean(this.activeRequest)
    const hadPendingQueue = this.queue.length > 0

    this.child = null

    if (this.activeRequest) {
      if (error) {
        this.activeRequest.reject(error)
      } else {
        this.activeRequest.reject(new Error('Void manager worker stopped before responding'))
      }
      this.activeRequest = null
    }

    while (this.queue.length > 0) {
      const pending = this.queue.shift()
      pending.reject(error || new Error('Void manager worker is unavailable'))
    }

    if (!this.shuttingDown && (hadActiveRequest || hadPendingQueue)) {
      try {
        this.ensureProcess()
      } catch (restartError) {
        console.error('Failed to restart Void manager worker', restartError)
      }
    }
  }

  drainStdout() {
    if (!this.child) {
      return
    }

    let newlineIndex = this.stdoutBuffer.indexOf('\n')
    while (newlineIndex !== -1) {
      const rawLine = this.stdoutBuffer.slice(0, newlineIndex)
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1)

      const line = rawLine.trim()
      if (line.length > 0) {
        this.processResponse(line)
      }

      newlineIndex = this.stdoutBuffer.indexOf('\n')
    }
  }

  processResponse(line) {
    let parsed
    try {
      parsed = JSON.parse(line)
    } catch (error) {
      const parseError = new Error(`Failed to parse Void manager response: ${error.message}`)
      if (this.activeRequest) {
        this.activeRequest.reject(parseError)
        this.activeRequest = null
      }
      this.flushQueue()
      return
    }

    if (!this.activeRequest) {
      // No active request, ignore stray output but log for debugging.
      console.warn('Received unexpected output from Void manager worker', parsed)
      return
    }

    if (parsed && typeof parsed === 'object' && parsed.error) {
      this.activeRequest.reject(new Error(parsed.error))
    } else {
      this.activeRequest.resolve(parsed)
    }
    this.activeRequest = null
    this.flushQueue()
  }

  enqueue(payload) {
    return new Promise((resolve, reject) => {
      const entry = { payload, resolve, reject }
      this.queue.push(entry)
      try {
        registerShutdownHooks()
        this.ensureProcess()
        this.flushQueue()
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error))
        const index = this.queue.indexOf(entry)
        if (index !== -1) {
          this.queue.splice(index, 1)
        }
        reject(failure)
      }
    })
  }

  flushQueue() {
    if (!this.child || this.child.exitCode !== null) {
      return
    }

    if (this.activeRequest || this.queue.length === 0) {
      return
    }

    const request = this.queue.shift()

    let serialized
    try {
      serialized = JSON.stringify(request.payload)
    } catch (error) {
      request.reject(new Error(`Failed to serialize payload for Void manager: ${error.message}`))
      this.flushQueue()
      return
    }

    this.activeRequest = request

    const message = `${serialized}\n`

    try {
      const flushed = this.child.stdin.write(message, error => {
        if (error) {
          this.handleProcessTermination(new Error(`Failed to send payload to Void manager: ${error.message}`))
        }
      })

      if (!flushed) {
        this.child.stdin.once('drain', () => {
          // Once drained, nothing specific to do because the message has already been queued.
        })
      }
    } catch (error) {
      this.handleProcessTermination(new Error(`Failed to send payload to Void manager: ${error.message}`))
    }
  }

  async shutdown() {
    if (!this.child || this.child.exitCode !== null) {
      return
    }

    this.shuttingDown = true

    try {
      const message = JSON.stringify({ command: SHUTDOWN_COMMAND }) + '\n'
      this.child.stdin.write(message)
    } catch {
      // Ignore shutdown write errors; we will still attempt to terminate the process.
    }

    this.child.stdin.end()

    const child = this.child
    const exitPromise = once(child, 'exit').then(() => true)
    const waitForExit = timeoutMs =>
      new Promise(resolve => {
        let settled = false
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true
            resolve(false)
          }
        }, timeoutMs)

        exitPromise
          .then(() => {
            if (!settled) {
              settled = true
              clearTimeout(timer)
              resolve(true)
            }
          })
          .catch(() => {
            if (!settled) {
              settled = true
              clearTimeout(timer)
              resolve(true)
            }
          })
      })

    let exited = await waitForExit(5000)

    if (!exited && child.exitCode === null) {
      child.kill('SIGTERM')
      exited = await waitForExit(2000)
    }

    if (!exited && child.exitCode === null) {
      child.kill('SIGKILL')
      await exitPromise.catch(() => true)
    }
  }
}

const worker = new VoidManagerWorker()

const runVoidManager = payload => worker.enqueue(payload)

const shutdownWorker = async () => {
  try {
    await worker.shutdown()
  } finally {
    removeShutdownHooks()
  }
}

const registerShutdownHooks = () => {
  if (shutdownHooksRegistered) {
    return
  }

  shutdownHooksRegistered = true

  exitHandler = () => {
    worker.shutdown().catch(() => {})
  }

  sigintHandler = () => {
    worker
      .shutdown()
      .catch(() => {})
      .finally(() => {
        removeShutdownHooks()
        process.exit(0)
      })
  }

  sigtermHandler = () => {
    worker
      .shutdown()
      .catch(() => {})
      .finally(() => {
        removeShutdownHooks()
        process.exit(0)
      })
  }

  process.once('exit', exitHandler)
  process.once('SIGINT', sigintHandler)
  process.once('SIGTERM', sigtermHandler)
}

const removeShutdownHooks = () => {
  if (!shutdownHooksRegistered) {
    return
  }

  if (exitHandler) {
    process.removeListener('exit', exitHandler)
    exitHandler = null
  }

  if (sigintHandler) {
    process.removeListener('SIGINT', sigintHandler)
    sigintHandler = null
  }

  if (sigtermHandler) {
    process.removeListener('SIGTERM', sigtermHandler)
    sigtermHandler = null
  }

  shutdownHooksRegistered = false
}

module.exports = {
  PYTHON_CANDIDATES,
  PYTHON_EXECUTABLE,
  runVoidManager,
  shutdownWorker
}
