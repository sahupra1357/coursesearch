"use client"

import {
  ExternalLink,
  Search,
  Loader2,
  MapPin,
  Trophy,
  IndianRupee,
  DollarSign,
  Clock,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CalendarDays,
  Globe,
  Briefcase,
  Sparkles,
  GraduationCap,
} from "lucide-react"
import { useState } from "react"
import type { CollegeResult } from "@/lib/types"

interface ResultsTableProps {
  results: CollegeResult[]
  isLoading: boolean
  hasSearched: boolean
  query: string
}

export function ResultsTable({ results, isLoading, hasSearched, query }: ResultsTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
          <Loader2 className="animate-spin text-[#003580]" size={36} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground mb-1">
            Searching for &ldquo;{query}&rdquo;…
          </p>
          <p className="text-xs text-muted-foreground">
            4 agents running in parallel — local colleges, top universities, admission details &amp; online courses
          </p>
        </div>
      </div>
    )
  }

  if (!hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#003580]/10 flex items-center justify-center mb-4">
          <Search size={28} className="text-[#003580]" />
        </div>
        <h3 className="font-semibold text-lg mb-1">Find the right course</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Enter a course name or field of study above. Add your city to see local colleges first.
        </p>
        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          {["Computer Science", "MBBS", "MBA", "BA LLB", "B.Tech ECE"].map((s) => (
            <span
              key={s}
              className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full border border-border"
            >
              {s}
            </span>
          ))}
        </div>
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

  const local = results.filter((r) => r.isLocal)
  const national = results.filter((r) => !r.isLocal && !r.isOnline)
  const online = results.filter((r) => r.isOnline)

  return (
    <div className="space-y-8">
      {local.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={14} className="text-[#00766C]" />
            <h2 className="text-sm font-semibold text-[#00766C] uppercase tracking-wide">
              Colleges Near You
            </h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {local.length}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {local.map((r) => (
              <CollegeCard key={r.id} result={r} />
            ))}
          </div>
        </section>
      )}

      {national.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} className="text-[#003580]" />
            <h2 className="text-sm font-semibold text-[#003580] uppercase tracking-wide">
              {local.length > 0 ? "Top Colleges Nationally" : "Top Colleges"}
            </h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {national.length}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {national.map((r) => (
              <CollegeCard key={r.id} result={r} />
            ))}
          </div>
        </section>
      )}

      {online.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Globe size={14} className="text-indigo-600" />
            <h2 className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">
              Learn Online Now
            </h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {online.length}
            </span>
            <span className="text-[10px] text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full font-medium">
              Start anytime
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {online.map((r) => (
              <CollegeCard key={r.id} result={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function CollegeCard({ result: r }: { result: CollegeResult }) {
  const [expanded, setExpanded] = useState(false)

  const accentColor = r.isOnline ? "text-indigo-600" : "text-[#003580]"
  const applyBg = r.isOnline
    ? "bg-indigo-600 hover:bg-indigo-700"
    : "bg-[#003580] hover:bg-[#002a6b]"
  const applyGhostBg = r.isOnline
    ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
    : "bg-[#003580]/10 text-[#003580] hover:bg-[#003580]/20"

  const hasDetails =
    r.admissionRequirements.length > 0 ||
    r.highlights.length > 0 ||
    r.careerPaths.length > 0 ||
    !!r.deadline

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
      {/* Online course accent stripe */}
      {r.isOnline && <div className="h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500" />}

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/60">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className={`font-semibold text-sm leading-snug flex-1 ${accentColor}`}>
            {r.college}
          </h3>
          <div className="flex gap-1 flex-shrink-0">
            {r.isLocal && (
              <span className="text-xs font-medium bg-[#00766C]/10 text-[#00766C] border border-[#00766C]/20 px-2 py-0.5 rounded-full">
                Local
              </span>
            )}
            {r.isOnline && (
              <span className="text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Globe size={9} />
                Online
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{r.course}</p>
        {r.ranking && (
          <div className="flex items-center gap-1 mt-1.5">
            <Trophy size={11} className="text-amber-500" />
            <span className="text-xs text-amber-700 font-medium">{r.ranking}</span>
          </div>
        )}
      </div>

      {/* Key stats row */}
      <div className="grid grid-cols-2 divide-x divide-border border-b border-border/60">
        <div className="px-4 py-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            {r.isOnline
              ? <DollarSign size={11} className="text-muted-foreground" />
              : <IndianRupee size={11} className="text-muted-foreground" />
            }
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {r.isOnline ? "Cost" : "Fees"}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">
            {r.fees ?? (r.isOnline ? "Check platform" : "Contact college")}
          </p>
          {r.scholarships && (
            <p className="text-[10px] text-emerald-600 mt-0.5 leading-snug">
              🎓 {r.scholarships}
            </p>
          )}
        </div>
        <div className="px-4 py-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            <Clock size={11} className="text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Duration
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">{r.duration ?? "—"}</p>
        </div>
      </div>

      {/* Description */}
      <p className="px-4 py-3 text-xs text-muted-foreground leading-relaxed border-b border-border/60">
        {r.description || "No description available."}
      </p>

      {/* Expandable details */}
      {hasDetails && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border-b border-border/60 w-full text-left"
          >
            <GraduationCap size={12} />
            <span className="font-medium">
              {r.isOnline ? "Course Details" : "Admission Details"}
            </span>
            {expanded ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
          </button>

          {expanded && (
            <div className="px-4 py-3 bg-muted/30 border-b border-border/60 space-y-3">
              {/* What you'll learn */}
              {r.highlights.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles size={11} className="text-violet-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      What you&apos;ll learn
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.highlights.map((h, i) => (
                      <span key={i} className="text-[11px] bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded-full">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Career paths */}
              {r.careerPaths.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Briefcase size={11} className="text-emerald-600" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Career paths
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.careerPaths.map((c, i) => (
                      <span key={i} className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Admission requirements (colleges only) */}
              {!r.isOnline && r.admissionRequirements.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CheckCircle2 size={11} className="text-[#003580]" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Admission requirements
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {r.admissionRequirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#003580] flex-shrink-0 mt-1.5" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Deadline */}
              {r.deadline && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700">
                  <CalendarDays size={12} />
                  <span>
                    <span className="font-medium">
                      {r.isOnline ? "Enrollment closes:" : "Apply by:"}
                    </span>{" "}
                    {r.deadline}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 px-4 py-3 mt-auto">
        <a
          href={r.courseLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium border border-border rounded-lg py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ExternalLink size={11} />
          {r.isOnline ? "View Course" : "Course Details"}
        </a>
        {r.admissionLink ? (
          <a
            href={r.admissionLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white rounded-lg py-2 transition-colors ${applyBg}`}
          >
            {r.isOnline ? "Enroll Now" : "Apply Now"}
          </a>
        ) : (
          <a
            href={r.courseLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg py-2 transition-colors ${applyGhostBg}`}
          >
            {r.isOnline ? "Start Learning" : "View Admission"}
          </a>
        )}
      </div>
    </div>
  )
}
