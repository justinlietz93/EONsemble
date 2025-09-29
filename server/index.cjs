const http = require('http')

const { readBody, sendJson } = require('./http-helpers.cjs')
const { mergeManagerConfig, isPlainObject } = require('./manager-config.cjs')
const { loadOpenAIModelCatalog, readBundledOpenAIModelCatalog } = require('./openai-catalog.cjs')
const { readData, writeData } = require('./persistence-store.cjs')
const { runVoidManager } = require('./python-bridge.cjs')

const handleHealthCheckRequest = (req, res) => {
  if (req.method === 'GET') {
    sendJson(res, 200, { status: 'ok' })
    return
  }

  if (req.method === 'HEAD') {
    res.writeHead(200)
    res.end()
    return
  }

  sendJson(res, 405, { error: 'Method Not Allowed' })
}

const handleStateRequest = async (req, res, key) => {
  const data = readData()

  if (req.method === 'GET') {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      sendJson(res, 200, { value: data[key] })
    } else {
      sendJson(res, 404, { value: null })
    }
    return
  }

  if (req.method === 'PUT') {
    try {
      const bodyText = await readBody(req)
      const parsed = bodyText ? JSON.parse(bodyText) : {}
      data[key] = parsed?.value ?? null
      writeData(data)
      sendJson(res, 200, { value: data[key] })
    } catch (error) {
      console.error('Failed to persist value', error)
      sendJson(res, 400, { error: 'Invalid JSON payload' })
    }
    return
  }

  if (req.method === 'DELETE') {
    delete data[key]
    writeData(data)
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    })
    res.end()
    return
  }

  sendJson(res, 405, { error: 'Method Not Allowed' })
}

const handleOpenAIModelsRequest = async (req, res, url) => {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' })
    return
  }

  const refreshFlag = url.searchParams.get('refresh')
  const forceRefresh = refreshFlag === '1' || refreshFlag === 'true'

  try {
    const catalog = await loadOpenAIModelCatalog({ forceRefresh })
    sendJson(res, 200, catalog)
  } catch (error) {
    console.error('Failed to resolve OpenAI model catalog', error)
    const fallbackCatalog = readBundledOpenAIModelCatalog()
    sendJson(res, 200, fallbackCatalog)
  }
}

const handleVoidRegister = async (req, res) => {
  try {
    const bodyText = await readBody(req)
    const parsedPayload = bodyText ? JSON.parse(bodyText) : {}
    const payload = isPlainObject(parsedPayload) ? parsedPayload : {}
    const config = mergeManagerConfig(payload.config)
    const commandPayload = {
      ...payload,
      config,
      command: 'register'
    }
    const result = await runVoidManager(commandPayload)
    sendJson(res, 200, result)
  } catch (error) {
    console.error('Void manager integration error', error)
    sendJson(res, 500, { error: 'Void manager integration failed' })
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (url.pathname.startsWith('/api/state/')) {
    const key = decodeURIComponent(url.pathname.replace('/api/state/', ''))

    if (key === '__healthcheck') {
      handleHealthCheckRequest(req, res)
      return
    }

    try {
      await handleStateRequest(req, res, key)
    } catch (error) {
      console.error('Failed to handle state request', error)
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Internal Server Error' })
      } else if (!res.writableEnded) {
        res.end()
      }
    }
    return
  }

  if (url.pathname === '/api/openai/models') {
    try {
      await handleOpenAIModelsRequest(req, res, url)
    } catch (error) {
      console.error('Failed to handle OpenAI model request', error)
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Internal Server Error' })
      } else if (!res.writableEnded) {
        res.end()
      }
    }
    return
  }

  if (url.pathname === '/api/void/register' && req.method === 'POST') {
    try {
      await handleVoidRegister(req, res)
    } catch (error) {
      console.error('Failed to handle Void manager registration', error)
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Void manager integration failed' })
      } else if (!res.writableEnded) {
        res.end()
      }
    }
    return
  }

  sendJson(res, 404, { error: 'Not Found' })
})

const port = process.env.PORT || 4000

if (require.main === module) {
  server.listen(port, () => {
    console.log(`Persistence server listening on port ${port}`)
  })
}

module.exports = server
