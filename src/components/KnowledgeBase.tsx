import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Database, MagnifyingGlass, Tag, Calendar, Trash, Upload, Network, Download, FileText } from '@phosphor-icons/react'
import { KnowledgeEntry, AgentResponse, PhysicsGoal } from '@/App'
import { CorpusUpload } from '@/components/CorpusUpload'
import { KnowledgeGraph } from '@/components/KnowledgeGraph'
import { formatMarkdownSection, formatTimestamp } from '@/lib/markdown-utils'
import { buildConceptTags } from '@/lib/knowledge-utils'
import { downloadJSON, downloadMarkdown } from '@/lib/download-utils'
import { toast } from 'sonner'

interface KnowledgeBaseProps {
  knowledgeBase: KnowledgeEntry[]
  setKnowledgeBase: (knowledge: KnowledgeEntry[]) => void
  derivationHistory?: AgentResponse[]
  goals?: PhysicsGoal[]
}

export function KnowledgeBase({ knowledgeBase, setKnowledgeBase, derivationHistory = [], goals = [] }: KnowledgeBaseProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [newEntry, setNewEntry] = useState({
    title: '',
    content: '',
    source: '',
    tags: ['']
  })

  const filteredEntries = knowledgeBase?.filter(entry => {
    const matchesSearch = searchQuery === '' || 
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesTag = selectedTag === null || entry.tags.includes(selectedTag)
    
    return matchesSearch && matchesTag
  }) || []

  const allTags = Array.from(new Set(knowledgeBase?.flatMap(entry => entry.tags) || []))

  const handleAddEntry = () => {
    const tags = buildConceptTags(newEntry.content, newEntry.tags.filter(tag => tag.trim()))

    const entry: KnowledgeEntry = {
      id: `knowledge-${Date.now()}`,
      title: newEntry.title,
      content: newEntry.content,
      source: newEntry.source,
      tags,
      timestamp: new Date().toISOString()
    }

    setKnowledgeBase([...(knowledgeBase || []), entry])
    setNewEntry({
      title: '',
      content: '',
      source: '',
      tags: ['']
    })
  }

  const handleDeleteEntry = (entryId: string) => {
    setKnowledgeBase((knowledgeBase || []).filter(entry => entry.id !== entryId))
  }

  const addTag = () => {
    setNewEntry(prev => ({
      ...prev,
      tags: [...prev.tags, '']
    }))
  }

  const updateTag = (index: number, value: string) => {
    setNewEntry(prev => ({
      ...prev,
      tags: prev.tags.map((tag, i) => i === index ? value : tag)
    }))
  }

  const exportKnowledgeJSON = () => {
    console.log('=== Starting Knowledge JSON Export ===')
    try {
      const dataToExport = filteredEntries.length < (knowledgeBase || []).length ? filteredEntries : (knowledgeBase || [])
      console.log(`Exporting ${dataToExport.length} entries out of ${(knowledgeBase || []).length} total`)
      
      if (dataToExport.length === 0) {
        toast.error('No knowledge entries to export')
        return
      }
      
      const exportData = {
        exported_at: new Date().toISOString(),
        total_entries: dataToExport.length,
        filtered: filteredEntries.length < (knowledgeBase || []).length,
        entries: dataToExport
      }

      const filename = `knowledge-base-${new Date().toISOString().split('T')[0]}.json`
      console.log(`Attempting to download: ${filename}`)
      
      const success = downloadJSON(exportData, filename)
      console.log(`Download success: ${success}`)
      
      if (success) {
        toast.success(`Knowledge base JSON downloaded! (${dataToExport.length} entries)`)
      } else {
        toast.error('Download failed. Please check browser console for details.')
      }
    } catch (error) {
      console.error('Export failed:', error)
      toast.error(`Export failed: ${error.message}`)
    }
    console.log('=== Knowledge JSON Export Complete ===')
  }

  const exportKnowledgeMarkdown = () => {
    console.log('=== Starting Knowledge Markdown Export ===')
    try {
      const dataToExport = filteredEntries.length < (knowledgeBase || []).length ? filteredEntries : (knowledgeBase || [])
      console.log(`Exporting ${dataToExport.length} entries out of ${(knowledgeBase || []).length} total`)
      
      if (dataToExport.length === 0) {
        toast.error('No knowledge entries to export')
        return
      }
      
      const now = new Date()
      let markdown = formatMarkdownSection('Knowledge Base Export', '', 1)
      markdown += `**Generated:** ${formatTimestamp(now.toISOString())}\n`
      markdown += `**Total Entries:** ${dataToExport.length}\n`
      if (filteredEntries.length < (knowledgeBase || []).length) {
        markdown += `**Filtered View:** Yes (showing ${dataToExport.length} of ${(knowledgeBase || []).length} total)\n`
      }
      markdown += `\n`

      dataToExport.forEach((entry, index) => {
        markdown += formatMarkdownSection(entry.title, '', 2)
        markdown += `**Source:** ${entry.source}\n`
        markdown += `**Created:** ${formatTimestamp(entry.timestamp)}\n`
        
        if (entry.tags.length > 0) {
          markdown += `**Tags:** ${entry.tags.join(', ')}\n`
        }
        
        markdown += `\n${entry.content}\n\n`
        
        if (index < dataToExport.length - 1) {
          markdown += `---\n\n`
        }
      })

      console.log(`Generated markdown: ${markdown.length} characters`)

      const filename = `knowledge-base-${new Date().toISOString().split('T')[0]}.md`
      console.log(`Attempting to download: ${filename}`)
      
      const success = downloadMarkdown(markdown, filename)
      console.log(`Download success: ${success}`)
      
      if (success) {
        toast.success(`Knowledge base markdown downloaded! (${dataToExport.length} entries)`)
      } else {
        toast.error('Download failed. Please check browser console for details.')
      }
    } catch (error) {
      console.error('Export failed:', error)
      toast.error(`Export failed: ${error.message}`)
    }
    console.log('=== Knowledge Markdown Export Complete ===')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Knowledge Base</h2>
          <p className="text-muted-foreground">
            {knowledgeBase?.length || 0} entries • Persistent physics knowledge
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={exportKnowledgeMarkdown}
            disabled={(knowledgeBase || []).length === 0}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Download Markdown
            {(knowledgeBase || []).length === 0 && " (No Data)"}
          </Button>
          <Button 
            variant="outline" 
            onClick={exportKnowledgeJSON}
            disabled={(knowledgeBase || []).length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export JSON
            {(knowledgeBase || []).length === 0 && " (No Data)"}
          </Button>
          {(knowledgeBase || []).length === 0 && (
            <Button 
              variant="outline" 
              onClick={() => {
                // Add sample data for testing downloads
                const sampleEntry: KnowledgeEntry = {
                  id: `sample-${Date.now()}`,
                  title: 'Sample Physics Knowledge',
                  content: 'This is a test entry for verifying download functionality. E = mc²',
                  source: 'Test Source',
                  tags: ['test', 'physics'],
                  timestamp: new Date().toISOString()
                }
                setKnowledgeBase([sampleEntry])
                toast.success('Sample data added - try downloads now!')
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Test Data
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="browse" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Browse
          </TabsTrigger>
          <TabsTrigger value="graph" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Knowledge Graph
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Corpus
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Manual Entry
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          {/* Search and Filter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MagnifyingGlass className="h-5 w-5" />
                Search & Filter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="search">Search Knowledge</Label>
                <Input
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search titles and content..."
                />
              </div>
              
              <div>
                <Label>Filter by Tag</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button
                    variant={selectedTag === null ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTag(null)}
                  >
                    All
                  </Button>
                  {allTags.map(tag => (
                    <Button
                      key={tag}
                      variant={selectedTag === tag ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedTag(tag)}
                      className="flex items-center gap-1"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Knowledge Entries */}
          <div className="space-y-4">
            {filteredEntries.length > 0 ? (
              filteredEntries.map(entry => (
                <Card key={entry.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{entry.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-muted-foreground">{entry.source}</p>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(entry.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        <Trash className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-48">
                      <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded">
                        {entry.content}
                      </pre>
                    </ScrollArea>
                    
                    {entry.tags.length > 0 && (
                      <>
                        <Separator className="my-4" />
                        <div className="flex flex-wrap gap-2">
                          {entry.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {knowledgeBase?.length === 0 ? 'No Knowledge Entries' : 'No Matching Entries'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {knowledgeBase?.length === 0 
                      ? 'Upload documents or add physics knowledge to build your collaborative database'
                      : 'Try adjusting your search or filter criteria'
                    }
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="graph">
          <KnowledgeGraph 
            knowledgeBase={knowledgeBase}
            derivationHistory={derivationHistory}
            goals={goals}
          />
        </TabsContent>

        <TabsContent value="upload">
          <CorpusUpload 
            knowledgeBase={knowledgeBase}
            setKnowledgeBase={setKnowledgeBase}
          />
        </TabsContent>

        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Add Knowledge Entry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="entry-title">Title</Label>
                <Input
                  id="entry-title"
                  value={newEntry.title}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Schrödinger Equation Derivation"
                />
              </div>

              <div>
                <Label htmlFor="entry-source">Source</Label>
                <Input
                  id="entry-source"
                  value={newEntry.source}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, source: e.target.value }))}
                  placeholder="e.g., Griffiths Quantum Mechanics, Chapter 2"
                />
              </div>

              <div>
                <Label htmlFor="entry-content">Content</Label>
                <Textarea
                  id="entry-content"
                  value={newEntry.content}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Detailed physics content, equations, derivations..."
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Tags</Label>
                  <Button variant="outline" size="sm" onClick={addTag}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {newEntry.tags.map((tag, index) => (
                  <Input
                    key={index}
                    value={tag}
                    onChange={(e) => updateTag(index, e.target.value)}
                    placeholder="e.g., quantum-mechanics, wave-function"
                    className="mb-2"
                  />
                ))}
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleAddEntry} disabled={!newEntry.title || !newEntry.content}>
                  Add Entry
                </Button>
                <Button variant="outline" onClick={() => {
                  setNewEntry({
                    title: '',
                    content: '',
                    source: '',
                    tags: ['']
                  })
                }}>
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}