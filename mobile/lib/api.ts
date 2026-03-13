import type { CollegeResult, SearchRecord } from "./types"

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "http://localhost:8000"

export async function search(
  query: string,
  location: string,
): Promise<{ results: CollegeResult[]; agents: string[]; usedMock: boolean }> {
  const resp = await fetch(`${BACKEND_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, location }),
  })
  if (!resp.ok) throw new Error("Search failed")
  return resp.json()
}

export async function getSavedSearches(): Promise<SearchRecord[]> {
  const resp = await fetch(`${BACKEND_URL}/saved`)
  if (!resp.ok) throw new Error("Failed to load saved searches")
  const data = await resp.json()
  return data.searches ?? []
}
