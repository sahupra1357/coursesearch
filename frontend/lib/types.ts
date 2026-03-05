export interface WebResult {
  id: string
  title: string
  url: string
  source: string
  snippet: string
  score: number
}

export interface SearchRecord {
  id: string
  query: string
  location: string
  searchedAt: string
  resultCount: number
  results: WebResult[]
}
