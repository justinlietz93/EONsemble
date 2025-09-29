import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// Type definitions for KaTeX components
interface KaTeXProps {
  math: string
  errorColor?: string
  renderError?: (error: Error) => React.ReactNode
}

// Custom KaTeX components using the library directly
const InlineMath = ({ math, ...props }: KaTeXProps) => {
  try {
    const html = katex.renderToString(math, { 
      displayMode: false, 
      throwOnError: false,
      strict: false
    })
    return <span dangerouslySetInnerHTML={{ __html: html }} {...props} />
  } catch (error) {
    return <span className="text-destructive bg-destructive/10 px-1 rounded">[Math Error: {math}]</span>
  }
}

const BlockMath = ({ math, ...props }: KaTeXProps) => {
  try {
    const html = katex.renderToString(math, { 
      displayMode: true, 
      throwOnError: false,
      strict: false
    })
    return <div className="my-4" dangerouslySetInnerHTML={{ __html: html }} {...props} />
  } catch (error) {
    return <div className="text-destructive p-2 border border-destructive/20 rounded my-4">[Math Error: {math}]</div>
  }
}

interface LaTeXRendererProps {
  content: string
  className?: string
}

interface MathPart {
  type: 'text' | 'block' | 'inline'
  content: string
}

interface MathMatch {
  start: number
  end: number
  content: string
}

export function LaTeXRenderer({ content, className = '' }: LaTeXRendererProps) {
  const processedContent = useMemo((): MathPart[] => {
    if (!content) {
      return []
    }

    const blockPattern = /\\\[([\s\S]*?)\\\]/g
    const inlinePattern = /\\\(([\s\S]*?)\\\)/g

    const parts: MathPart[] = []

    const blockMatches: MathMatch[] = []
    let blockMatch: RegExpExecArray | null
    while ((blockMatch = blockPattern.exec(content)) !== null) {
      blockMatches.push({
        start: blockMatch.index,
        end: blockMatch.index + blockMatch[0].length,
        content: blockMatch[1]
      })
    }

    blockPattern.lastIndex = 0

    const inlineMatches: MathMatch[] = []
    let inlineMatch: RegExpExecArray | null
    while ((inlineMatch = inlinePattern.exec(content)) !== null) {
      const start = inlineMatch.index
      const end = start + inlineMatch[0].length
      const isInsideBlock = blockMatches.some(
        (block) => start >= block.start && start < block.end
      )
      if (!isInsideBlock) {
        inlineMatches.push({ start, end, content: inlineMatch[1] })
      }
    }

    const allMatches = [
      ...blockMatches.map((match) => ({ ...match, type: 'block' as const })),
      ...inlineMatches.map((match) => ({ ...match, type: 'inline' as const }))
    ].sort((a, b) => a.start - b.start)

    let currentIndex = 0
    for (const match of allMatches) {
      if (currentIndex < match.start) {
        const textContent = content.slice(currentIndex, match.start)
        if (textContent.trim().length > 0) {
          parts.push({ type: 'text', content: textContent })
        }
      }

      parts.push({ type: match.type, content: match.content })
      currentIndex = match.end
    }

    if (currentIndex < content.length) {
      const textContent = content.slice(currentIndex)
      if (textContent.trim().length > 0) {
        parts.push({ type: 'text', content: textContent })
      }
    }

    if (parts.length === 0) {
      parts.push({ type: 'text', content })
    }

    return parts
  }, [content])

  return (
    <div className={`latex-content ${className}`}>
      {processedContent.map((part, index) => {
        switch (part.type) {
          case 'block':
            try {
              return (
                <div key={index} className="my-4">
                  <BlockMath math={part.content.trim()} />
                </div>
              )
            } catch {
              return (
                <div
                  key={index}
                  className="my-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm"
                >
                  <strong>LaTeX Error:</strong> {part.content}
                </div>
              )
            }
          case 'inline':
            try {
              return <InlineMath key={index} math={part.content.trim()} />
            } catch {
              return (
                <span key={index} className="bg-destructive/10 px-1 rounded text-sm">
                  [LaTeX Error: {part.content}]
                </span>
              )
            }
          default:
            return (
              <span key={index}>
                {part.content.split('\n').map((line, lineIndex, lines) => (
                  <span key={lineIndex}>
                    {line}
                    {lineIndex < lines.length - 1 && <br />}
                  </span>
                ))}
              </span>
            )
        }
      })}
    </div>
  )
}
