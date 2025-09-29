#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_AUTONOMOUS_CONFIG = {
  enabled: false,
  maxCycles: 50,
  stopOnGammaDecision: true,
  continueOvernight: true
}

function mergeAutonomousConfig(previous = {}) {
  const sanitized = typeof previous === 'object' && previous !== null ? previous : {}
  const next = { ...DEFAULT_AUTONOMOUS_CONFIG }

  if (typeof sanitized.enabled === 'boolean') {
    next.enabled = sanitized.enabled
  }
  if (Number.isFinite(sanitized.maxCycles)) {
    const clamped = Math.max(1, Math.min(500, Math.trunc(sanitized.maxCycles)))
    next.maxCycles = clamped
  }
  if (typeof sanitized.stopOnGammaDecision === 'boolean') {
    next.stopOnGammaDecision = sanitized.stopOnGammaDecision
  }
  if (typeof sanitized.continueOvernight === 'boolean') {
    next.continueOvernight = sanitized.continueOvernight
  }

  return next
}

function ensureVoidMemoryMetadata(previous = {}) {
  const meta = typeof previous === 'object' && previous !== null ? { ...previous } : {}
  meta.persistenceVersion = 1
  meta.lastMigration = new Date().toISOString()
  return meta
}

function main() {
  const [, , targetPath] = process.argv
  if (!targetPath) {
    console.error('Usage: node scripts/migrate-autonomous-config.mjs <path-to-config.json>')
    process.exitCode = 1
    return
  }

  const resolvedPath = resolve(process.cwd(), targetPath)
  let payload = {}

  try {
    const raw = readFileSync(resolvedPath, 'utf8')
    payload = JSON.parse(raw)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Existing config could not be parsed, starting from a clean slate.', error)
    }
    payload = {}
  }

  const nextPayload = { ...payload }
  nextPayload.autonomous = mergeAutonomousConfig(payload.autonomous)
  nextPayload.voidMemory = ensureVoidMemoryMetadata(payload.voidMemory)

  writeFileSync(resolvedPath, `${JSON.stringify(nextPayload, null, 2)}\n`, 'utf8')
  console.log(`Autonomous configuration migrated at ${resolvedPath}`)
}

main()
