import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, 
  File, 
  CheckCircle, 
  XCircle, 
  WarningCircle,
  Database,
  FileText,
  Clock
} from '@phosphor-icons/react'
import { KnowledgeEntry } from '@/App'
import { toast } from 'sonner'

interface CorpusUploadProps {
  knowledgeBase: KnowledgeEntry[]
  setKnowledgeBase: (knowledge: KnowledgeEntry[]) => void
}

interface UploadedFile {
  id: string
  file: File
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  extractedText?: string
  error?: string
}

const WORDS_PER_CHUNK = 500

function getFileTypeTag(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':
      return 'pdf'
    case 'txt':
      return 'text'
    case 'md':
      return 'markdown'
    case 'tex':
      return 'latex'
    default:
      return 'document'
  }
}

function chunkText(text: string, filename: string): KnowledgeEntry[] {
  const chunks: string[] = []
  const sections = text.split(/\n\s*\n|\n#+\s+/).filter(section => section.trim().length > 100)

  if (sections.length === 0) {
    const words = text.split(/\s+/)
    for (let index = 0; index < words.length; index += WORDS_PER_CHUNK) {
      const chunk = words.slice(index, index + WORDS_PER_CHUNK).join(' ')
      if (chunk.trim().length > 50) {
        chunks.push(chunk)
      }
    }
  } else {
    chunks.push(...sections)
  }

  return chunks.map((chunk, index) => ({
    id: `${filename}-chunk-${index}-${Date.now()}`,
    title: `${filename} - Section ${index + 1}`,
    content: chunk.trim(),
    source: filename,
    tags: ['imported', 'corpus', getFileTypeTag(filename)].filter(Boolean),
    timestamp: new Date().toISOString()
  }))
}

export function CorpusUpload({ knowledgeBase, setKnowledgeBase }: CorpusUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const extractTextFromFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const content = e.target?.result as string
        if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          resolve(content)
        } else if (file.type === 'application/pdf') {
          // For PDF files, we'll show a simplified message
          resolve(`[PDF Content from ${file.name}]\n\nNote: For full PDF text extraction, please convert to text format first.`)
        } else {
          resolve(content)
        }
      }
      
      reader.onerror = () => reject(new Error('Failed to read file'))
      
      if (file.type === 'application/pdf') {
        reader.readAsArrayBuffer(file)
      } else {
        reader.readAsText(file)
      }
    })
  }

  const processFile = useCallback(async (uploadedFile: UploadedFile) => {
    try {
      // Update status to processing
      setFiles(prev => prev.map(f =>
        f.id === uploadedFile.id
          ? { ...f, status: 'processing', progress: 10 }
          : f
      ))

      // Extract text from file
      const extractedText = await extractTextFromFile(uploadedFile.file)
      
      setFiles(prev => prev.map(f => 
        f.id === uploadedFile.id 
          ? { ...f, progress: 50, extractedText }
          : f
      ))

      // Chunk the text into knowledge entries
      const chunks = chunkText(extractedText, uploadedFile.file.name)
      
      setFiles(prev => prev.map(f => 
        f.id === uploadedFile.id 
          ? { ...f, progress: 80 }
          : f
      ))

      // Add to knowledge base
      setKnowledgeBase([...(knowledgeBase || []), ...chunks])
      
      // Mark as completed
      setFiles(prev => prev.map(f => 
        f.id === uploadedFile.id 
          ? { ...f, status: 'completed', progress: 100 }
          : f
      ))

      toast.success(`Processed ${uploadedFile.file.name} - Added ${chunks.length} knowledge entries`)

    } catch (error) {
      setFiles(prev => prev.map(f =>
        f.id === uploadedFile.id
          ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Processing failed' }
          : f
      ))
      toast.error(`Failed to process ${uploadedFile.file.name}`)
    }
  }, [knowledgeBase, setKnowledgeBase])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'text/markdown',
      'application/x-tex'
    ]
    
    const validFiles = droppedFiles.filter(file => 
      allowedTypes.includes(file.type) || 
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.tex') ||
      file.name.endsWith('.pdf')
    )

    if (validFiles.length !== droppedFiles.length) {
      toast.error('Some files were skipped. Only text, PDF, Markdown, and LaTeX files are supported.')
    }

    const newFiles: UploadedFile[] = validFiles.map(file => ({
      id: `file-${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
      progress: 0
    }))

    setFiles(prev => [...prev, ...newFiles])
    setIsProcessing(true)

    // Process files sequentially
    for (const file of newFiles) {
      await processFile(file)
    }

    setIsProcessing(false)
  }, [processFile])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'text/markdown',
      'application/x-tex'
    ]
    
    const validFiles = selectedFiles.filter(file => 
      allowedTypes.includes(file.type) || 
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.tex') ||
      file.name.endsWith('.pdf')
    )

    if (validFiles.length !== selectedFiles.length) {
      toast.error('Some files were skipped. Only text, PDF, Markdown, and LaTeX files are supported.')
    }

    const newFiles: UploadedFile[] = validFiles.map(file => ({
      id: `file-${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
      progress: 0
    }))

    setFiles(prev => [...prev, ...newFiles])
    setIsProcessing(true)

    // Process files sequentially
    for (const file of newFiles) {
      await processFile(file)
    }

    setIsProcessing(false)
  }

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'completed'))
  }

  const clearAll = () => {
    setFiles([])
  }

  const completedCount = files.filter(f => f.status === 'completed').length
  const errorCount = files.filter(f => f.status === 'error').length
  const processingCount = files.filter(f => f.status === 'processing').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Corpus Upload</h3>
          <p className="text-muted-foreground">
            Drag and drop physics documents to automatically extract and chunk knowledge
          </p>
        </div>
        {files.length > 0 && (
          <div className="flex gap-2">
            {completedCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearCompleted}>
                Clear Completed
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear All
            </Button>
          </div>
        )}
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="p-0">
          <div
            className={`
              border-2 border-dashed rounded-lg p-12 text-center transition-colors
              ${isDragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              Drop your physics documents here
            </h3>
            <p className="text-muted-foreground mb-4">
              Supports: PDF, Text, Markdown, LaTeX files
            </p>
            <input
              type="file"
              multiple
              accept=".txt,.pdf,.md,.tex"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button variant="outline" className="cursor-pointer">
                <File className="h-4 w-4 mr-2" />
                Choose Files
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Upload Status */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Upload Status
              </CardTitle>
              <div className="flex gap-2">
                {completedCount > 0 && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {completedCount} Completed
                  </Badge>
                )}
                {processingCount > 0 && (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    {processingCount} Processing
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {errorCount} Failed
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-96">
              <div className="space-y-4">
                {files.map(file => (
                  <div key={file.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium">{file.file.name}</span>
                        <span className="text-sm text-muted-foreground">
                          ({Math.round(file.file.size / 1024)} KB)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.status === 'completed' && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                        {file.status === 'error' && (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        {file.status === 'processing' && (
                          <Clock className="h-4 w-4 text-blue-600 animate-spin" />
                        )}
                      </div>
                    </div>
                    
                    {file.status === 'processing' && (
                      <Progress value={file.progress} className="mb-2" />
                    )}
                    
                    {file.error && (
                      <Alert variant="destructive">
                        <WarningCircle className="h-4 w-4" />
                        <AlertDescription>{file.error}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {isProcessing && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Processing files and extracting knowledge entries...
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}