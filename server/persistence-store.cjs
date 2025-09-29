const fs = require('fs')
const path = require('path')

const { DATA_FILE } = require('./constants.cjs')

const overrideFile = process.env.VOID_PERSISTENCE_DATA_FILE
const overrideDir = process.env.VOID_PERSISTENCE_DATA_DIR

const resolvedDataFile =
  overrideFile || (overrideDir ? path.join(overrideDir, path.basename(DATA_FILE)) : DATA_FILE)
const resolvedDataDir = overrideDir || path.dirname(resolvedDataFile)

const createTempFilePath = () => `${resolvedDataFile}.${process.pid}.${Date.now()}.tmp`

const ensureDataDir = () => {
  try {
    fs.mkdirSync(resolvedDataDir, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error('Failed to ensure data directory', error)
    }
  }
}

const readData = () => {
  try {
    ensureDataDir()
    const raw = fs.readFileSync(resolvedDataFile, 'utf-8')
    return JSON.parse(raw)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {}
    }
    console.error('Failed to read persistence store', error)
    return {}
  }
}

const writeData = data => {
  ensureDataDir()

  let serialized
  try {
    serialized = JSON.stringify(data, null, 2)
  } catch (error) {
    console.error('Failed to serialize persistence payload', error)
    throw error
  }

  const tempPath = createTempFilePath()

  try {
    fs.writeFileSync(tempPath, serialized, 'utf-8')
    fs.renameSync(tempPath, resolvedDataFile)
  } catch (error) {
    try {
      fs.unlinkSync(tempPath)
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') {
        console.error('Failed to cleanup temp persistence file', cleanupError)
      }
    }

    console.error('Failed to write persistence store atomically', error)
    throw error
  }
}

module.exports = {
  ensureDataDir,
  readData,
  writeData
}
