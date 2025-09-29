import { beforeAll, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'

type ResponseStub = {
  writeHead: (status: number, headers: Record<string, string>) => void
  end: (body: string) => void
}

let readBody: (req: EventEmitter, options?: { maxBytes?: number }) => Promise<string>
let sendJson: (res: ResponseStub, status: number, payload: unknown) => void

beforeAll(async () => {
  const module = await import('../../server/http-helpers.cjs')
  readBody = module.readBody
  sendJson = module.sendJson
})

describe('http helpers', () => {
  it('aggregates streamed request body chunks into a single string', async () => {
    const request = new EventEmitter()

    const bodyPromise = readBody(request)

    request.emit('data', 'partial-')
    request.emit('data', 'payload')
    request.emit('end')

    await expect(bodyPromise).resolves.toBe('partial-payload')
  })

  it('rejects when the request emits an error event', async () => {
    const request = new EventEmitter()
    const bodyPromise = readBody(request)
    const failure = new Error('boom')

    request.emit('error', failure)

    await expect(bodyPromise).rejects.toBe(failure)
  })

  it('rejects when the payload exceeds the configured limit', async () => {
    const request = new EventEmitter()
    const bodyPromise = readBody(request, { maxBytes: 4 })

    request.emit('data', '1234')
    request.emit('data', '5')

    await expect(bodyPromise).rejects.toThrow('Request body exceeded limit')
  })

  it('writes JSON payloads with the expected CORS headers', () => {
    const writeHead = vi.fn()
    const end = vi.fn()

    const response: ResponseStub = {
      writeHead,
      end
    }

    const payload = { ok: true, message: 'hello' }

    sendJson(response, 201, payload)

    expect(writeHead).toHaveBeenCalledWith(201, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    })
    expect(end).toHaveBeenCalledWith(JSON.stringify(payload))
  })
})
