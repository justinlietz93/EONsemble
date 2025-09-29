/**
 * Utility functions for reliable file downloads with better error handling
 */

export function downloadFile(content: string, filename: string, mimeType = 'text/plain'): boolean {
  console.log(`Attempting to download file: ${filename} (${content?.length || 0} characters)`)
  if (!content) {
    console.error('Download failed: No content provided')
    return false
  }
  if (!filename || filename.trim() === '') {
    console.error('Download failed: No filename provided')
    return false
  }
  try {
    const blob = new Blob([content], { type: mimeType })
    // Primary path
    const success = downloadFileTraditional(blob, filename)
    if (!success) {
      console.warn('Primary download method did not confirm success, attempting window fallback')
      return downloadViaNewWindow(content, filename, mimeType)
    }
    return true
  } catch (error) {
    console.error('Download failed (exception). Attempting window fallback.', error)
    try {
      return downloadViaNewWindow(content, filename, mimeType)
    } catch (e) {
      console.error('All download strategies failed.', e)
      return false
    }
  }
}

function downloadFileTraditional(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = filename
    a.type = blob.type || 'application/octet-stream'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 250)
    console.log(`Download triggered for: ${filename}`)
    return true
  } catch (error) {
    console.error('Traditional download method failed', error)
    return false
  }
}

export function downloadJSON(data: unknown, filename: string): boolean {
  console.log('Starting JSON download:', filename)
  
  if (!data) {
    console.error('No data provided for JSON download')
    return false
  }
  
  try {
    const jsonString = JSON.stringify(data, null, 2)
    console.log(`JSON serialized: ${jsonString.length} characters`)
    return downloadFile(jsonString, filename, 'application/json')
  } catch (error) {
    console.error('JSON serialization failed:', error)
    return false
  }
}

export function downloadMarkdown(content: string, filename: string): boolean {
  console.log('Starting Markdown download:', filename)
  
  if (!content || content.trim() === '') {
    console.error('No content provided for Markdown download')
    return false
  }
  
  console.log(`Markdown content: ${content.length} characters`)
  return downloadFile(content, filename, 'text/markdown')
}

/**
 * Test function to validate download functionality
 */
export function testDownloadFunctionality(): boolean {
  console.log('Testing download functionality...')
  const testData = { test: true, timestamp: new Date().toISOString(), message: 'Download test successful!' }
  const testFilename = `download-test-${Date.now()}.json`
  return downloadJSON(testData, testFilename)
}

/**
 * Alternative download method that opens content in a new window for manual saving
 */
export function downloadViaNewWindow(content: string, filename: string, mimeType = 'text/plain'): boolean {
  try {
    console.log(`Opening content in new window for manual save: ${filename}`)
    
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    
    const newWindow = window.open(url, '_blank')
    
    if (newWindow) {
      // Add instructions in the new window
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url)
        } catch (error) {
          console.warn('URL cleanup error:', error)
        }
      }, 10000) // Clean up after 10 seconds
      
      console.log(`Content opened in new window for manual save`)
      return true
    } else {
      console.error('Popup blocked - could not open new window')
      return false
    }
  } catch (error) {
    console.error('New window download method failed:', error)
    return false
  }
}