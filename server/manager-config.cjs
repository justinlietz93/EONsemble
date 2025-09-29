const { DEFAULT_MANAGER_CONFIG } = require('./constants.cjs')

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

const mergeManagerConfig = config => {
  const merged = { ...DEFAULT_MANAGER_CONFIG }

  if (!isPlainObject(config)) {
    return merged
  }

  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) {
      continue
    }

    if (Object.prototype.hasOwnProperty.call(DEFAULT_MANAGER_CONFIG, key)) {
      const defaultValue = DEFAULT_MANAGER_CONFIG[key]
      if (typeof defaultValue === 'number') {
        const numeric = Number(value)
        if (Number.isFinite(numeric)) {
          merged[key] = numeric
        }
        continue
      }
    }

    merged[key] = value
  }

  return merged
}

module.exports = {
  DEFAULT_MANAGER_CONFIG,
  isPlainObject,
  mergeManagerConfig
}
