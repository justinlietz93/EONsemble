import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpyInstance } from 'vitest'

describe('persistence server healthcheck endpoint', () => {
  let server: Server
  let readDataSpy: SpyInstance
  let writeDataSpy: SpyInstance
  let baseUrl: string

  beforeAll(async () => {
    vi.resetModules()

    const persistenceStoreModule = await import('../../server/persistence-store.cjs')
    const persistenceStore = persistenceStoreModule.default ?? persistenceStoreModule

    readDataSpy = vi.spyOn(persistenceStore, 'readData')
    writeDataSpy = vi.spyOn(persistenceStore, 'writeData')

    const serverModule = await import('../../server/index.cjs')
    server = serverModule.default ?? serverModule

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo | string | null

        if (!address || typeof address === 'string') {
          throw new Error('Failed to determine persistence server address')
        }

        baseUrl = `http://127.0.0.1:${address.port}`
        resolve()
      })
    })
  })

  afterAll(async () => {
    readDataSpy.mockRestore()
    writeDataSpy.mockRestore()

    await new Promise<void>(resolve => {
      server.close(() => resolve())
    })
  })

  beforeEach(() => {
    readDataSpy.mockClear()
    writeDataSpy.mockClear()
  })

  it('returns ok without touching persistence storage', async () => {
    const response = await fetch(`${baseUrl}/api/state/__healthcheck`, { cache: 'no-store' })
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload).toEqual({ status: 'ok' })

    expect(readDataSpy).not.toHaveBeenCalled()
    expect(writeDataSpy).not.toHaveBeenCalled()
  })

  it('rejects unsupported methods', async () => {
    const response = await fetch(`${baseUrl}/api/state/__healthcheck`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    })

    expect(response.status).toBe(405)
    expect(readDataSpy).not.toHaveBeenCalled()
    expect(writeDataSpy).not.toHaveBeenCalled()
  })
})
