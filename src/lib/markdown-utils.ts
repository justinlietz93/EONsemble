/**
 * Utility functions for markdown export with LaTeX support
 */

export function cleanLatexForMarkdown(content: string): string {
  // Replace LaTeX delimiters for better markdown compatibility
  let cleaned = content
    .replace(/\\\[/g, '\n$$\n')  // Block equations
    .replace(/\\\]/g, '\n$$\n')
    .replace(/\\\(/g, '$')       // Inline equations  
    .replace(/\\\)/g, '$')
  
  // Clean up excessive newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
  
  return cleaned
}

export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString()
}

const MARKDOWN_SPECIAL_CHARACTERS = new Set(['*', '_', '`', '[', ']', '(', ')', '#', '+', '-', '.', '!', '|'])

export function escapeMarkdown(text: string): string {
  return text
    .split('')
    .map(character => (MARKDOWN_SPECIAL_CHARACTERS.has(character) ? `\\${character}` : character))
    .join('')
}

export function formatMarkdownSection(title: string, content: string, level = 1): string {
  const headingPrefix = '#'.repeat(level)
  return `${headingPrefix} ${title}\n\n${content}\n\n`
}