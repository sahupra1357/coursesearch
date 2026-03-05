"use client"

import { ExternalLink, BookOpen, Search, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import type { WebResult } from "@/lib/types"

interface ResultsTableProps {
  results: WebResult[]
  isLoading: boolean
  hasSearched: boolean
  query: string
}

export function ResultsTable({ results, isLoading, hasSearched, query }: ResultsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-sm text-muted-foreground">Searching the web for &ldquo;{query}&rdquo;…</p>
      </div>
    )
  }

  if (!hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Search size={28} className="text-primary" />
        </div>
        <h3 className="font-semibold text-lg mb-1">Search for a course</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Enter a course name, skill, or category above to search the web for matching programmes.
        </p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <BookOpen size={28} className="text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-1">No results found</h3>
        <p className="text-muted-foreground text-sm max-w-xs">Try a different search term.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-8">
                #
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                Title
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-40">
                Source
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                Description
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-20">
                Link
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {results.map((r, i) => (
              <tr
                key={r.id}
                className="bg-card hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{i + 1}</td>
                <td className="px-4 py-3">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#003580] hover:underline leading-snug line-clamp-2"
                  >
                    {r.title}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full border border-border">
                    <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-[#003580] to-[#00766C] flex-shrink-0" />
                    {r.source}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs leading-relaxed max-w-sm">
                  <p className="line-clamp-2">{r.snippet}</p>
                </td>
                <td className="px-4 py-3">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    Open
                    <ExternalLink size={11} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card-list */}
      <div className="md:hidden divide-y divide-border">
        {results.map((r, i) => {
          const isExpanded = expandedRow === r.id
          return (
            <div key={r.id} className="bg-card px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="text-xs font-mono text-muted-foreground mt-0.5 w-5 flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sm text-[#003580] hover:underline leading-snug block"
                  >
                    {r.title}
                  </a>
                  <span className="text-xs text-muted-foreground mt-1 block">{r.source}</span>

                  {isExpanded && (
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{r.snippet}</p>
                  )}
                </div>
                <button
                  onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                  className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5"
                >
                  {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
