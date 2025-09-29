export const API_BASE_URL = import.meta.env.VITE_PERSISTENCE_URL ?? 'http://localhost:4000'

export const buildApiUrl = (path: string) => {
  const normalizedBase = API_BASE_URL.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}
