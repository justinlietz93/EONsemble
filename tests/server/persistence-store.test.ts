import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const originalDataDir = process.env.VOID_PERSISTENCE_DATA_DIR
const originalDataFile = process.env.VOID_PERSISTENCE_DATA_FILE

let tempDir: string
let dataFile: string

describe('persistence store', () => {
  const loadModule = async () => {
    vi.resetModules()
    return import('../../server/persistence-store.cjs')
  }

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'void-store-'))
    dataFile = path.join(tempDir, 'state.json')
    process.env.VOID_PERSISTENCE_DATA_DIR = tempDir
    process.env.VOID_PERSISTENCE_DATA_FILE = dataFile
  })

  afterEach(() => {
    if (originalDataDir === undefined) {
      delete process.env.VOID_PERSISTENCE_DATA_DIR
    } else {
      process.env.VOID_PERSISTENCE_DATA_DIR = originalDataDir
    }

    if (originalDataFile === undefined) {
      delete process.env.VOID_PERSISTENCE_DATA_FILE
    } else {
      process.env.VOID_PERSISTENCE_DATA_FILE = originalDataFile
    }

    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('writes the persistence payload atomically to disk', async () => {
    const module = await loadModule()
    const { readData, writeData } = module

    expect(readData()).toEqual({})

    const payload = { foo: 'bar', nested: { count: 3 } }
    writeData(payload)

    const raw = fs.readFileSync(dataFile, 'utf-8')
    expect(JSON.parse(raw)).toEqual(payload)

    const files = fs.readdirSync(tempDir).filter(name => name !== 'state.json')
    expect(files).toHaveLength(0)
  })

  it('throws when serialization fails and leaves no partial file behind', async () => {
    const module = await loadModule()
    const { writeData } = module

    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(() => writeData(circular)).toThrow()
    expect(fs.existsSync(dataFile)).toBe(false)

    const files = fs.readdirSync(tempDir)
    expect(files).toHaveLength(0)
  })
})
