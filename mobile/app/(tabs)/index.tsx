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
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { search } from "@/lib/api"
import type { WebResult } from "@/lib/types"

const PRIMARY = "#003580"
const TEAL = "#00766C"

export default function SearchScreen() {
  const [query, setQuery] = useState("")
  const [location, setLocation] = useState("")
  const [results, setResults] = useState<WebResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usedMock, setUsedMock] = useState(false)

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
    } catch {
      setError("Search failed. Make sure the backend is running.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.headerSub}>COURSE DISCOVERY</Text>
          <Text style={s.headerTitle}>Find the Right Course</Text>
          <Text style={s.headerDesc}>
            Search courses from top institutes worldwide
          </Text>

          {/* Search card */}
          <View style={s.searchCard}>
            <View style={s.inputRow}>
              <Ionicons name="search-outline" size={16} color="#64748b" />
              <TextInput
                style={s.input}
                placeholder="Course name, skill, or category…"
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
                placeholder="Your city…"
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
              <Text style={s.searchBtnText}>Search</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Banners ── */}
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

        {/* ── Body ── */}
        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={s.loadingText}>Searching the web…</Text>
          </View>
        ) : !hasSearched ? (
          <View style={s.center}>
            <Ionicons name="search-circle-outline" size={64} color={PRIMARY} />
            <Text style={s.emptyTitle}>Search for a course</Text>
            <Text style={s.emptyDesc}>
              Enter a course name or skill above to find programmes.
            </Text>
            <Text style={s.hint}>Try: "Data Science", "MBA", "AI"</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={s.center}>
            <Ionicons name="book-outline" size={64} color="#94a3b8" />
            <Text style={s.emptyTitle}>No results found</Text>
            <Text style={s.emptyDesc}>Try a different search term.</Text>
          </View>
        ) : (
          <>
            <View style={s.resultsHeader}>
              <Text style={s.resultsCount}>
                {results.length} result{results.length !== 1 ? "s" : ""} ·{" "}
                <Text style={{ color: TEAL }}>saved</Text>
              </Text>
            </View>
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.list}
              keyboardDismissMode="on-drag"
              renderItem={({ item, index }) => (
                <ResultCard item={item} index={index} />
              )}
            />
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function ResultCard({ item, index }: { item: WebResult; index: number }) {
  return (
    <View style={s.card}>
      <View style={s.cardRow}>
        <Text style={s.cardIndex}>{index + 1}</Text>
        <View style={s.cardContent}>
          <Pressable onPress={() => Linking.openURL(item.url)}>
            <Text style={s.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </Pressable>
          <View style={s.sourceBadge}>
            <Text style={s.sourceBadgeText}>{item.source}</Text>
          </View>
          <Text style={s.snippet} numberOfLines={2}>
            {item.snippet}
          </Text>
        </View>
        <Pressable style={s.openBtn} onPress={() => Linking.openURL(item.url)}>
          <Ionicons name="open-outline" size={18} color={PRIMARY} />
        </Pressable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },

  // Header
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "600",
    marginBottom: 4,
  },
  headerTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  headerDesc: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginBottom: 16,
  },

  // Search card
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
  input: { flex: 1, fontSize: 14, color: "#0f172a" },
  searchBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  searchBtnText: { color: "white", fontWeight: "600", fontSize: 15 },

  // Banners
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
  mockText: { color: "#92400e", fontSize: 12, flex: 1 },
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
  errorText: { color: "#dc2626", fontSize: 12, flex: 1 },

  // States
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  loadingText: { color: "#64748b", fontSize: 14, marginTop: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#0f172a" },
  emptyDesc: { fontSize: 13, color: "#64748b", textAlign: "center" },
  hint: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
    textAlign: "center",
  },

  // Results
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "white",
  },
  resultsCount: { fontSize: 12, color: "#64748b" },
  list: { padding: 12, gap: 8 },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  cardIndex: {
    fontSize: 11,
    color: "#94a3b8",
    fontVariant: ["tabular-nums"],
    marginTop: 2,
    minWidth: 16,
  },
  cardContent: { flex: 1, gap: 6 },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: PRIMARY,
    lineHeight: 20,
  },
  sourceBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sourceBadgeText: { fontSize: 11, color: "#64748b" },
  snippet: { fontSize: 12, color: "#64748b", lineHeight: 18 },
  openBtn: { padding: 4 },
})
