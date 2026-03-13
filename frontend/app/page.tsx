"use client"

import { useState, useEffect } from "react"
import { Clock, ChevronDown, ChevronRight, RefreshCw, AlertCircle } from "lucide-react"
import { SearchHero } from "@/components/course-search/search-hero"
import { ResultsTable } from "@/components/course-search/results-table"
import type { CollegeResult, SearchRecord } from "@/lib/types"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8001"

type Tab = "results" | "saved"

export default function CourseSearchPage() {
  const [query, setQuery] = useState("")
  const [locationName, setLocationName] = useState("")
  const [isLocating, setIsLocating] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [activeQuery, setActiveQuery] = useState("")
  const [results, setResults] = useState<CollegeResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [usedMock, setUsedMock] = useState(false)

  const [activeTab, setActiveTab] = useState<Tab>("results")
  const [savedSearches, setSavedSearches] = useState<SearchRecord[]>([])
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [expandedSaved, setExpandedSaved] = useState<string | null>(null)

  function handleDetectLocation() {
    if (!navigator.geolocation) {
      setLocationName("Location unavailable")
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationName("Bangalore, Karnataka")
        setIsLocating(false)
      },
      () => {
        setLocationName("")
        setIsLocating(false)
      },
      { timeout: 8000 },
    )
  }

  async function handleSearch() {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return

    setIsSearching(true)
    setHasSearched(true)
    setActiveQuery(trimmedQuery)
    setError(null)
    setResults([])
    setActiveTab("results")

    try {
      const resp = await fetch(`${BACKEND_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery, location: locationName.trim() }),
      })

      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error ?? "Search failed")
      }

      const data = await resp.json()
      setResults(data.results ?? [])
      setUsedMock(!!data.usedMock)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsSearching(false)
    }
  }

  async function loadSavedSearches() {
    setLoadingSaved(true)
    try {
      const resp = await fetch(`${BACKEND_URL}/saved`)
      if (resp.ok) {
        const data = await resp.json()
        setSavedSearches(data.searches ?? [])
      }
    } finally {
      setLoadingSaved(false)
    }
  }

  useEffect(() => {
    if (activeTab === "saved") {
      loadSavedSearches()
    }
  }, [activeTab])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <SearchHero
        query={query}
        setQuery={setQuery}
        locationName={locationName}
        setLocationName={setLocationName}
        onSearch={handleSearch}
        isLocating={isLocating}
        onDetectLocation={handleDetectLocation}
      />

      <div className="max-w-screen-xl mx-auto px-4 py-6">
        {/* Mock data notice */}
        {usedMock && hasSearched && !isSearching && (
          <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>
              Showing demo results. Set{" "}
              <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">TAVILY_API_KEY</code>{" "}
              in <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">.env.local</code> to
              search the live web.
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2.5 text-sm text-destructive">
            <AlertCircle size={15} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border mb-5">
          {(["results", "saved"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "border-[#003580] text-[#003580]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "results" ? (
                <>
                  Search Results
                  {hasSearched && !isSearching && (
                    <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-normal">
                      {results.length}
                    </span>
                  )}
                </>
              ) : (
                "Saved Searches"
              )}
            </button>
          ))}
        </div>

        {/* Results tab */}
        {activeTab === "results" && (
          <div>
            {hasSearched && !isSearching && results.length > 0 && (
              <p className="text-xs text-muted-foreground mb-3">
                Web results for <span className="font-semibold text-foreground">&ldquo;{activeQuery}&rdquo;</span>
                {locationName && (
                  <>
                    {" "}near <span className="font-semibold text-foreground">{locationName}</span>
                  </>
                )}
                &nbsp;· {results.length} result{results.length !== 1 ? "s" : ""} · stored for future reference
              </p>
            )}
            <ResultsTable
              results={results}
              isLoading={isSearching}
              hasSearched={hasSearched}
              query={activeQuery}
            />
          </div>
        )}

        {/* Saved searches tab */}
        {activeTab === "saved" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">
                {savedSearches.length} saved search{savedSearches.length !== 1 ? "es" : ""}
              </p>
              <button
                onClick={loadSavedSearches}
                disabled={loadingSaved}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw size={11} className={loadingSaved ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            {loadingSaved ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="animate-spin text-muted-foreground" size={20} />
              </div>
            ) : savedSearches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                  <Clock size={20} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">No saved searches yet</p>
                <p className="text-xs text-muted-foreground">
                  Your searches will be automatically saved here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedSearches.map((s) => {
                  const isExpanded = expandedSaved === s.id
                  return (
                    <div
                      key={s.id}
                      className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedSaved(isExpanded ? null : s.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{s.query}</span>
                            {s.location && (
                              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {s.location}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {formatDate(s.searchedAt)}
                            </span>
                            <span>{s.resultCount} result{s.resultCount !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown size={15} className="text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight size={15} className="text-muted-foreground flex-shrink-0" />
                        )}
                      </button>

                      {isExpanded && s.results.length > 0 && (
                        <div className="border-t border-border overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/50">
                                <th className="text-left font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2 w-6">#</th>
                                <th className="text-left font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2">College</th>
                                <th className="text-left font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2 w-24 hidden sm:table-cell">Fees</th>
                                <th className="text-left font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2 hidden md:table-cell">Admission</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {s.results.map((r, i) => (
                                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                                  <td className="px-4 py-2 font-mono text-muted-foreground">{i + 1}</td>
                                  <td className="px-4 py-2">
                                    <a href={r.courseLink} target="_blank" rel="noopener noreferrer"
                                      className="text-[#003580] hover:underline font-medium line-clamp-1">
                                      {r.college}
                                    </a>
                                    <p className="text-muted-foreground mt-0.5 line-clamp-1">{r.course}</p>
                                  </td>
                                  <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{r.fees ?? "—"}</td>
                                  <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">
                                    <p className="line-clamp-1">
                                      {r.admissionRequirements[0] ?? "—"}
                                    </p>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
