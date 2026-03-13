export interface CollegeResult {
  id: string
  college: string
  course: string
  location: string
  isLocal: boolean
  ranking: string | null
  fees: string | null
  duration: string | null
  admissionRequirements: string[]
  admissionLink: string | null
  courseLink: string
  description: string
  deadline: string | null
  source: string
  score: number
  foundBy: string
}

export interface SearchRecord {
  id: string
  query: string
  location: string
  searchedAt: string
  resultCount: number
  results: CollegeResult[]
  agents?: string[]
}
