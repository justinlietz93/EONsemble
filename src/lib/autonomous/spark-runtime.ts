export interface SparkRuntime {
  llmPrompt: (strings: TemplateStringsArray, ...values: unknown[]) => string
  llm: (prompt: string, modelName?: string, jsonMode?: boolean) => Promise<string>
}

declare global {
  interface Window {
    spark?: SparkRuntime
  }
}

export const sparkRuntime: SparkRuntime | undefined =
  typeof window !== 'undefined' ? window.spark : undefined
