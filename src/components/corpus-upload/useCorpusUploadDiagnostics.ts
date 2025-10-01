import { useCallback, useEffect, useRef } from 'react'

import type { UploadedFile } from './types'

type PendingUploadDiagnostics = {
  fileId: string
  fileName: string
  startedAt: number
}

const SHOULD_LOG_DIAGNOSTICS = import.meta.env.MODE !== 'production'

const emitDiagnostics = (
  level: 'debug' | 'warn',
  message: string,
  payload?: Record<string, unknown>
) => {
  if (!SHOULD_LOG_DIAGNOSTICS) {
    return
  }

  const emitter = level === 'warn' ? console.warn : console.debug
  emitter?.(`[CorpusUpload] ${message}`, payload ?? {})
}

export function useCorpusUploadDiagnostics(
  setFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>
) {
  const isMountedRef = useRef(false)
  const pendingUploadsRef = useRef<Map<string, PendingUploadDiagnostics>>(new Map())

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false

      if (pendingUploadsRef.current.size > 0) {
        const pending = Array.from(pendingUploadsRef.current.values()).map(entry => ({
          ...entry,
          durationMs: Date.now() - entry.startedAt
        }))
        emitDiagnostics('warn', 'Unmounted with uploads still in flight', {
          pendingUploads: pending
        })
      }

      pendingUploadsRef.current.clear()
    }
  }, [])

  const updateFiles = useCallback(
    (updater: (files: UploadedFile[]) => UploadedFile[]) => {
      setFiles(prev => {
        if (!isMountedRef.current) {
          emitDiagnostics('debug', 'Skipped file state update after unmount', {
            pendingUploads: pendingUploadsRef.current.size
          })
          return prev
        }

        return updater(prev)
      })
    },
    [setFiles]
  )

  const registerUploadStart = useCallback((uploadedFile: UploadedFile) => {
    const startedAt = Date.now()
    pendingUploadsRef.current.set(uploadedFile.id, {
      fileId: uploadedFile.id,
      fileName: uploadedFile.file.name,
      startedAt
    })
    emitDiagnostics('debug', 'Started processing file', {
      fileId: uploadedFile.id,
      fileName: uploadedFile.file.name,
      queueSize: pendingUploadsRef.current.size
    })
    return startedAt
  }, [])

  const logCompletion = useCallback(
    (uploadedFile: UploadedFile, chunkCount: number, startedAt: number) => {
      const durationMs = Date.now() - startedAt

      emitDiagnostics(
        isMountedRef.current ? 'debug' : 'warn',
        isMountedRef.current
          ? 'Completed processing file'
          : 'Completed knowledge update after unmount',
        {
          fileId: uploadedFile.id,
          fileName: uploadedFile.file.name,
          chunkCount,
          durationMs
        }
      )
    },
    []
  )

  const logError = useCallback((uploadedFile: UploadedFile, error: unknown) => {
    emitDiagnostics('warn', 'Failed to process file', {
      fileId: uploadedFile.id,
      fileName: uploadedFile.file.name,
      error: error instanceof Error ? error.message : 'Unknown error',
      unmounted: !isMountedRef.current
    })
  }, [])

  const clearPending = useCallback((fileId: string) => {
    pendingUploadsRef.current.delete(fileId)
    emitDiagnostics('debug', 'Cleared pending upload entry', {
      fileId,
      remaining: pendingUploadsRef.current.size
    })
  }, [])

  return {
    updateFiles,
    registerUploadStart,
    logCompletion,
    logError,
    clearPending
  }
}
