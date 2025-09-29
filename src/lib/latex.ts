const blockPattern = /\\\[[\s\S]*?\\\]/
const inlinePattern = /\\\([\s\S]*?\\\)/

export function hasLaTeX(content: string): boolean {
  return blockPattern.test(content) || inlinePattern.test(content)
}

export function autoDetectMath(content: string): string {
  let processed = content

  processed = processed.replace(
    /^([^\n]*[=<>±∞∑∏∫∂∇√π∈∉⊆⊇∪∩∨∧¬∀∃λδεφψωαβγθμνρστυχζη][^\n]*)$/gm,
    (match) => {
      if (match.includes('\\(') || match.includes('\\[')) {
        return match
      }
      return `\\[${match.trim()}\\]`
    }
  )

  processed = processed.replace(/\b(\d+\/\d+|\w+\/\w+)\b/g, (match) => `\\(${match}\\)`)

  return processed
}
