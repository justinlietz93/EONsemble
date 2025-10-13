const DEFAULT_MAX_BODY_SIZE = 5 * 1024 * 1024

class BodySizeLimitError extends Error {
  constructor(limit) {
    super('Request body exceeded limit')
    this.name = 'BodySizeLimitError'
    this.statusCode = 413
    this.limit = limit
  }
}

const sendJson = (res, status, payload) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })
  res.end(JSON.stringify(payload))
}

const readBody = (req, options = {}) =>
  new Promise((resolve, reject) => {
    const { maxBytes = DEFAULT_MAX_BODY_SIZE } = options
    const chunks = []
    let totalBytes = 0

    const cleanup = () => {
      req.removeListener('data', onData)
      req.removeListener('error', onError)
      req.removeListener('aborted', onAbort)
      req.removeListener('end', onEnd)
    }

    const onError = error => {
      cleanup()
      reject(error)
    }

    const onAbort = () => {
      cleanup()
      reject(new Error('Request aborted'))
    }

    const onData = chunk => {
      const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      totalBytes += bufferChunk.length

      if (totalBytes > maxBytes) {
        cleanup()
        reject(new BodySizeLimitError(maxBytes))
        return
      }

      chunks.push(bufferChunk)
    }

    const onEnd = () => {
      cleanup()
      resolve(Buffer.concat(chunks).toString('utf-8'))
    }

    req.on('data', onData)
    req.once('error', onError)
    req.once('aborted', onAbort)
    req.once('end', onEnd)
  })

module.exports = {
  DEFAULT_MAX_BODY_SIZE,
  BodySizeLimitError,
  readBody,
  sendJson
}
