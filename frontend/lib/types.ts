export interface CollegeResult {
  id: string
  college: string
  course: string
  location: string
  isLocal: boolean
  isOnline: boolean
  ranking: string | null
  fees: string | null
  scholarships: string | null
  duration: string | null
  admissionRequirements: string[]
  admissionLink: string | null
  courseLink: string
  description: string
  deadline: string | null
  highlights: string[]
  careerPaths: string[]
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
