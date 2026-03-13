import React, { useState } from "react"
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { search } from "@/lib/api"
import type { CollegeResult } from "@/lib/types"

const PRIMARY = "#003580"
const TEAL = "#00766C"

export default function SearchScreen() {
  const [query, setQuery] = useState("")
  const [location, setLocation] = useState("")
  const [results, setResults] = useState<CollegeResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usedMock, setUsedMock] = useState(false)
  const [agents, setAgents] = useState<string[]>([])

  async function handleSearch() {
    const q = query.trim()
    if (!q) return
    setIsLoading(true)
    setHasSearched(true)
    setError(null)
    setResults([])
    try {
      const data = await search(q, location.trim())
      setResults(data.results)
      setUsedMock(data.usedMock)
      setAgents(data.agents ?? [])
    } catch {
      setError("Search failed. Make sure the backend is running.")
    } finally {
      setIsLoading(false)
    }
  }

  const local = results.filter((r) => r.isLocal)
  const national = results.filter((r) => !r.isLocal)

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerSub}>COLLEGE ADMISSION SEARCH</Text>
          <Text style={s.headerTitle}>Find the Right Course</Text>
          <Text style={s.headerDesc}>
            AI agents fetch colleges, fees &amp; admission details for you
          </Text>

          <View style={s.searchCard}>
            <View style={s.inputRow}>
              <Ionicons name="search-outline" size={16} color="#64748b" />
              <TextInput
                style={s.input}
                placeholder="Course name, e.g. Computer Science…"
                placeholderTextColor="#94a3b8"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
            </View>
            <View style={s.inputRow}>
              <Ionicons name="location-outline" size={16} color="#64748b" />
              <TextInput
                style={s.input}
                placeholder="Your city (optional)…"
                placeholderTextColor="#94a3b8"
                value={location}
                onChangeText={setLocation}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
            </View>
            <Pressable
              style={({ pressed }) => [s.searchBtn, pressed && { opacity: 0.85 }]}
              onPress={handleSearch}
            >
              <Ionicons name="search" size={16} color="white" />
              <Text style={s.searchBtnText}>Search Colleges</Text>
            </Pressable>
          </View>
        </View>

        {/* Banners */}
        {usedMock && hasSearched && !isLoading && (
          <View style={s.mockBanner}>
            <Ionicons name="information-circle-outline" size={14} color="#92400e" />
            <Text style={s.mockText}>
              Demo results. Set TAVILY_API_KEY in backend for live search.
            </Text>
          </View>
        )}
        {error && (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* Body */}
        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={s.loadingText}>Agents searching for colleges…</Text>
            <Text style={s.loadingSubText}>Fetching fees, requirements &amp; admission links</Text>
          </View>
        ) : !hasSearched ? (
          <View style={s.center}>
            <Ionicons name="school-outline" size={64} color={PRIMARY} />
            <Text style={s.emptyTitle}>Search for a course</Text>
            <Text style={s.emptyDesc}>
              Enter a course above to find colleges with fees, admission requirements, and apply links.
            </Text>
            <Text style={s.hint}>Try: "Computer Science", "MBBS", "MBA", "BA LLB"</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={s.center}>
            <Ionicons name="book-outline" size={64} color="#94a3b8" />
            <Text style={s.emptyTitle}>No results found</Text>
            <Text style={s.emptyDesc}>Try a different search term.</Text>
          </View>
        ) : (
          <FlatList
            data={[{ key: "content" }]}
            keyExtractor={(item) => item.key}
            keyboardDismissMode="on-drag"
            renderItem={() => (
              <View>
                {/* Agents badge */}
                {agents.length > 0 && (
                  <View style={s.agentRow}>
                    <Ionicons name="git-network-outline" size={11} color="#64748b" />
                    <Text style={s.agentText}>
                      {agents.join(" · ")}
                    </Text>
                  </View>
                )}

                {/* Local colleges */}
                {local.length > 0 && (
                  <View style={s.section}>
                    <View style={s.sectionHeader}>
                      <Ionicons name="location" size={13} color={TEAL} />
                      <Text style={[s.sectionTitle, { color: TEAL }]}>COLLEGES NEAR YOU</Text>
                      <View style={s.countBadge}><Text style={s.countBadgeText}>{local.length}</Text></View>
                    </View>
                    {local.map((r) => <CollegeCard key={r.id} item={r} />)}
                  </View>
                )}

                {/* National ranked colleges */}
                {national.length > 0 && (
                  <View style={s.section}>
                    <View style={s.sectionHeader}>
                      <Ionicons name="trophy" size={13} color={PRIMARY} />
                      <Text style={[s.sectionTitle, { color: PRIMARY }]}>
                        {local.length > 0 ? "TOP COLLEGES NATIONALLY" : "TOP COLLEGES"}
                      </Text>
                      <View style={s.countBadge}><Text style={s.countBadgeText}>{national.length}</Text></View>
                    </View>
                    {national.map((r) => <CollegeCard key={r.id} item={r} />)}
                  </View>
                )}
              </View>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function CollegeCard({ item: r }: { item: CollegeResult }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <View style={cs.card}>
      {/* Top row */}
      <View style={cs.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={cs.collegeName} numberOfLines={2}>{r.college}</Text>
          <Text style={cs.courseName}>{r.course}</Text>
          {r.ranking && (
            <View style={cs.rankRow}>
              <Ionicons name="trophy-outline" size={11} color="#b45309" />
              <Text style={cs.rankText}>{r.ranking}</Text>
            </View>
          )}
        </View>
        {r.isLocal && (
          <View style={cs.localBadge}>
            <Text style={cs.localBadgeText}>Local</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={cs.statsRow}>
        <View style={cs.statCell}>
          <Text style={cs.statLabel}>FEES</Text>
          <Text style={cs.statValue}>{r.fees ?? "—"}</Text>
        </View>
        <View style={[cs.statCell, cs.statBorder]}>
          <Text style={cs.statLabel}>DURATION</Text>
          <Text style={cs.statValue}>{r.duration ?? "—"}</Text>
        </View>
        {r.deadline && (
          <View style={[cs.statCell, cs.statBorder]}>
            <Text style={cs.statLabel}>DEADLINE</Text>
            <Text style={[cs.statValue, { color: "#b45309" }]}>{r.deadline}</Text>
          </View>
        )}
      </View>

      {/* Description */}
      <Text style={cs.description} numberOfLines={2}>{r.description}</Text>

      {/* Requirements toggle */}
      <Pressable style={cs.reqToggle} onPress={() => setExpanded((v) => !v)}>
        <Ionicons name="checkmark-circle-outline" size={13} color="#64748b" />
        <Text style={cs.reqToggleText}>Admission Requirements</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={13}
          color="#94a3b8"
          style={{ marginLeft: "auto" }}
        />
      </Pressable>

      {expanded && (
        <View style={cs.reqList}>
          {r.admissionRequirements.length > 0 ? (
            r.admissionRequirements.map((req, i) => (
              <View key={i} style={cs.reqItem}>
                <View style={cs.reqDot} />
                <Text style={cs.reqText}>{req}</Text>
              </View>
            ))
          ) : (
            <Text style={cs.reqText}>Contact the college for admission details.</Text>
          )}
        </View>
      )}

      {/* Action buttons */}
      <View style={cs.actions}>
        <Pressable
          style={cs.btnOutline}
          onPress={() => Linking.openURL(r.courseLink)}
        >
          <Ionicons name="open-outline" size={13} color="#64748b" />
          <Text style={cs.btnOutlineText}>Course Details</Text>
        </Pressable>
        <Pressable
          style={cs.btnPrimary}
          onPress={() => Linking.openURL(r.admissionLink ?? r.courseLink)}
        >
          <Text style={cs.btnPrimaryText}>Apply Now</Text>
        </Pressable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 4,
  },
  headerTitle: { color: "white", fontSize: 20, fontWeight: "700", marginBottom: 4 },
  headerDesc: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 16 },

  searchCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
  },
  input: { flex: 1, fontSize: 13, color: "#0f172a" },
  searchBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  searchBtnText: { color: "white", fontWeight: "700", fontSize: 14 },

  mockBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    margin: 12,
    padding: 12,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
  },
  mockText: { color: "#92400e", fontSize: 11, flex: 1 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 12,
    padding: 12,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
  },
  errorText: { color: "#dc2626", fontSize: 11, flex: 1 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  loadingText: { color: "#0f172a", fontSize: 14, fontWeight: "600", marginTop: 8 },
  loadingSubText: { color: "#64748b", fontSize: 12, textAlign: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#0f172a" },
  emptyDesc: { fontSize: 13, color: "#64748b", textAlign: "center" },
  hint: { fontSize: 12, color: "#94a3b8", textAlign: "center" },

  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "white",
  },
  agentText: { fontSize: 10, color: "#64748b" },

  section: { paddingHorizontal: 12, paddingTop: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  countBadge: {
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countBadgeText: { fontSize: 10, color: "#64748b" },
})

const cs = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  collegeName: { fontSize: 13, fontWeight: "700", color: PRIMARY, marginBottom: 2 },
  courseName: { fontSize: 11, color: "#64748b" },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  rankText: { fontSize: 10, color: "#b45309", fontWeight: "600" },
  localBadge: {
    backgroundColor: "#f0fdf4",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  localBadgeText: { fontSize: 10, color: "#15803d", fontWeight: "700" },

  statsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  statCell: { flex: 1, paddingHorizontal: 14, paddingVertical: 10 },
  statBorder: { borderLeftWidth: 1, borderLeftColor: "#f1f5f9" },
  statLabel: { fontSize: 8, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.5, marginBottom: 2 },
  statValue: { fontSize: 12, fontWeight: "700", color: "#0f172a" },

  description: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },

  reqToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  reqToggleText: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  reqList: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 6,
  },
  reqItem: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  reqDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: PRIMARY,
    marginTop: 5,
    flexShrink: 0,
  },
  reqText: { fontSize: 11, color: "#475569", lineHeight: 16, flex: 1 },

  actions: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  btnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnOutlineText: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  btnPrimary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnPrimaryText: { fontSize: 11, fontWeight: "700", color: "white" },
})
