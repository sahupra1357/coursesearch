"use client"

import { useState, useEffect, useRef } from "react"
import { Clock, ChevronDown, ChevronRight, RefreshCw, AlertCircle, MapPin } from "lucide-react"
import { SearchHero } from "@/components/course-search/search-hero"
import { ResultsTable } from "@/components/course-search/results-table"
import type { CollegeResult, SearchRecord } from "@/lib/types"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8001"
const LOCATION_PREF_KEY = "coursesearch_location_pref"
const LOCATION_CACHE_KEY = "coursesearch_location_cache"
// Bump this version whenever the cache format changes to force re-detection
const CACHE_VERSION = "2"
const CACHE_VERSION_KEY = "coursesearch_cache_version"

type Tab = "results" | "saved"
type LocationPref = "allow-while-using" | null

// Custom location permission dialog
function LocationPermissionDialog({
  onAllow,
  onAllowWhileUsing,
  onDeny,
}: {
  onAllow: () => void
  onAllowWhileUsing: () => void
  onDeny: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-80 mx-4 overflow-hidden">
        <div className="flex flex-col items-center px-6 pt-7 pb-5 text-center">
          <div className="w-12 h-12 rounded-full bg-[#003580]/10 flex items-center justify-center mb-4">
            <MapPin size={22} className="text-[#003580]" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            CourseSearch
          </p>
          <h2 className="text-base font-semibold mb-2">Allow access to your location?</h2>
          <p className="text-sm text-muted-foreground leading-snug">
            Your location helps us find courses and colleges near you.
          </p>
        </div>
        <div className="border-t border-border divide-y divide-border">
          <button
            onClick={onAllowWhileUsing}
            className="w-full py-3.5 text-sm font-medium text-[#003580] hover:bg-muted/40 transition-colors"
          >
            Allow while using
          </button>
          <button
            onClick={onAllow}
            className="w-full py-3.5 text-sm font-medium text-[#003580] hover:bg-muted/40 transition-colors"
          >
            Allow once
          </button>
          <button
            onClick={onDeny}
            className="w-full py-3.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            Don&apos;t allow
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CourseSearchPage() {
  const [query, setQuery] = useState("")
  const [locationName, setLocationName] = useState("")
  const [isLocating, setIsLocating] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [activeQuery, setActiveQuery] = useState("")
  const [results, setResults] = useState<CollegeResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showLocationDialog, setShowLocationDialog] = useState(false)

  const [activeTab, setActiveTab] = useState<Tab>("results")
  const [savedSearches, setSavedSearches] = useState<SearchRecord[]>([])
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [expandedSaved, setExpandedSaved] = useState<string | null>(null)

  // Resolves with a location string after the user picks an option
  const locationResolverRef = useRef<((loc: string) => void) | null>(null)

  // On mount: invalidate stale cache, then restore or detect location
  useEffect(() => {
    // Clear old cache if version mismatch
    if (localStorage.getItem(CACHE_VERSION_KEY) !== CACHE_VERSION) {
      localStorage.removeItem(LOCATION_CACHE_KEY)
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION)
    }

    const pref = localStorage.getItem(LOCATION_PREF_KEY) as LocationPref
    if (pref === "allow-while-using") {
      const cached = localStorage.getItem(LOCATION_CACHE_KEY) ?? ""
      if (cached) {
        setLocationName(cached)
      } else {
        // No cached location — detect country via IP immediately on load
        fetch("https://ipwho.is/")
          .then((r) => r.json())
          .then((data) => {
            const country = data.country || ""
            if (country) {
              setLocationName(country)
              localStorage.setItem(LOCATION_CACHE_KEY, country)
            }
          })
          .catch(() => {})
      }
    }
  }, [])

  async function reverseGeocode(lat: number, lon: number): Promise<string> {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { "Accept-Language": "en" } },
      )
      const data = await resp.json()
      const city =
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.county ||
        ""
      const state = data.address?.state || ""
      const country = data.address?.country || ""
      if (city) return state ? `${city}, ${state}` : city
      if (state) return country ? `${state}, ${country}` : state
      return country
    } catch {
      return ""
    }
  }

  async function fetchRealLocation(): Promise<string> {
    if (!navigator.geolocation) return ""
    setIsLocating(true)
    return new Promise<string>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const cityName = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
          setIsLocating(false)
          resolve(cityName)
        },
        () => {
          setIsLocating(false)
          resolve("")
        },
        { timeout: 10000 },
      )
    })
  }

  /** Shows the custom dialog and returns whatever location the user ultimately grants (or ""). */
  function requestLocationViaDialog(): Promise<string> {
    return new Promise<string>((resolve) => {
      locationResolverRef.current = resolve
      setShowLocationDialog(true)
    })
  }

  async function handleDialogAllowWhileUsing() {
    setShowLocationDialog(false)
    localStorage.setItem(LOCATION_PREF_KEY, "allow-while-using")
    const city = await fetchRealLocation()
    setLocationName(city)
    if (city) localStorage.setItem(LOCATION_CACHE_KEY, city)
    locationResolverRef.current?.(city)
    locationResolverRef.current = null
  }

  async function handleDialogAllow() {
    setShowLocationDialog(false)
    const city = await fetchRealLocation()
    setLocationName(city)
    locationResolverRef.current?.(city)
    locationResolverRef.current = null
  }

  async function handleDialogDeny() {
    // "Don't Allow" = no GPS, but detect country via IP to show country-specific results
    setShowLocationDialog(false)
    setIsLocating(true)
    let country = ""
    try {
      const resp = await fetch("https://ipwho.is/")
      const data = await resp.json()
      country = data.country || ""
    } catch {
      country = ""
    } finally {
      setIsLocating(false)
    }
    if (country) setLocationName(country)
    locationResolverRef.current?.(country)
    locationResolverRef.current = null
  }

  /** Called by the locate button in the search bar */
  async function handleDetectLocation() {
    const pref = localStorage.getItem(LOCATION_PREF_KEY) as LocationPref
    if (pref === "allow-while-using") {
      const city = await fetchRealLocation()
      setLocationName(city)
      if (city) localStorage.setItem(LOCATION_CACHE_KEY, city)
    } else {
      const city = await requestLocationViaDialog()
      setLocationName(city)
    }
  }

  async function getCountryFromIP(): Promise<string> {
    try {
      const resp = await fetch("https://ipwho.is/")
      const data = await resp.json()
      return data.country || ""
    } catch {
      return ""
    }
  }

  async function resolveLocation(): Promise<string> {
    const existing = locationName.trim()
    if (existing) return existing

    const pref = localStorage.getItem(LOCATION_PREF_KEY) as LocationPref

    if (pref === "allow-while-using") {
      // Re-fetch fresh coords — country is the minimum fallback from reverseGeocode
      let loc = await fetchRealLocation()
      // GPS failed — fall back to IP country so we never search globally
      if (!loc) loc = await getCountryFromIP()
      if (loc) {
        setLocationName(loc)
        localStorage.setItem(LOCATION_CACHE_KEY, loc)
      }
      return loc
    }

    // No saved preference — show dialog every time location field is empty
    return requestLocationViaDialog()
  }

  async function handleSearch() {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return

    const resolvedLocation = await resolveLocation()

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
        body: JSON.stringify({ query: trimmedQuery, location: resolvedLocation }),
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        const detail = data.detail ?? data.error
        if (resp.status === 503) {
          throw new Error("Search is not configured. Please set TAVILY_API_KEY on the server to enable live results.")
        } else if (resp.status === 502) {
          throw new Error("No results found for your query. Try different keywords or check back later.")
        } else {
          throw new Error(detail ?? "Something went wrong. Please try again.")
        }
      }

      const data = await resp.json()
      setResults(data.results ?? [])
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError("Unable to connect to the server. Please check your connection or try again later.")
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
      }
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
      {showLocationDialog && (
        <LocationPermissionDialog
          onAllowWhileUsing={handleDialogAllowWhileUsing}
          onAllow={handleDialogAllow}
          onDeny={handleDialogDeny}
        />
      )}

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
