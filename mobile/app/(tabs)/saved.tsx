import React, { useState, useCallback } from "react"
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Linking,
  RefreshControl,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useFocusEffect } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { getSavedSearches } from "@/lib/api"
import type { SearchRecord } from "@/lib/types"

const PRIMARY = "#003580"

export default function SavedScreen() {
  const [searches, setSearches] = useState<SearchRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await getSavedSearches()
      setSearches(data)
    } catch {
      // silently fail — backend may not be running yet
    } finally {
      setLoading(false)
    }
  }

  // Reload whenever this tab comes into focus
  useFocusEffect(useCallback(() => { load() }, []))

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
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Saved Searches</Text>
        <Text style={s.headerDesc}>
          {searches.length} search{searches.length !== 1 ? "es" : ""} stored
        </Text>
      </View>

      {loading && searches.length === 0 ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : searches.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="bookmark-outline" size={64} color="#94a3b8" />
          <Text style={s.emptyTitle}>No saved searches</Text>
          <Text style={s.emptyDesc}>
            Your searches are automatically saved here after each query.
          </Text>
        </View>
      ) : (
        <FlatList
          data={searches}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={PRIMARY}
            />
          }
          renderItem={({ item }) => {
            const isExp = expanded === item.id
            return (
              <View style={s.card}>
                {/* Card header row */}
                <Pressable
                  style={s.cardHeader}
                  onPress={() => setExpanded(isExp ? null : item.id)}
                >
                  <View style={s.cardHeaderContent}>
                    <View style={s.queryRow}>
                      <Text style={s.query}>{item.query}</Text>
                      {item.location ? (
                        <View style={s.locationBadge}>
                          <Text style={s.locationText}>{item.location}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={s.metaRow}>
                      <Ionicons name="time-outline" size={11} color="#94a3b8" />
                      <Text style={s.meta}>{formatDate(item.searchedAt)}</Text>
                      <Text style={s.metaDot}>·</Text>
                      <Text style={s.meta}>
                        {item.resultCount} result{item.resultCount !== 1 ? "s" : ""}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isExp ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#94a3b8"
                  />
                </Pressable>

                {/* Expanded results list */}
                {isExp && item.results.length > 0 && (
                  <View style={s.resultList}>
                    {item.results.map((r, i) => (
                      <Pressable
                        key={r.id}
                        style={s.resultRow}
                        onPress={() => Linking.openURL(r.url)}
                      >
                        <Text style={s.resultIndex}>{i + 1}</Text>
                        <View style={s.resultContent}>
                          <Text style={s.resultTitle} numberOfLines={1}>
                            {r.title}
                          </Text>
                          <Text style={s.resultSource}>{r.source}</Text>
                        </View>
                        <Ionicons name="open-outline" size={14} color="#94a3b8" />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },

  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: { color: "white", fontSize: 22, fontWeight: "700", marginBottom: 2 },
  headerDesc: { color: "rgba(255,255,255,0.6)", fontSize: 13 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#0f172a" },
  emptyDesc: { fontSize: 13, color: "#64748b", textAlign: "center" },

  list: { padding: 12, gap: 8 },

  card: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  cardHeaderContent: { flex: 1, gap: 4 },
  queryRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  query: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  locationBadge: {
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  locationText: { fontSize: 11, color: "#64748b" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontSize: 11, color: "#94a3b8" },
  metaDot: { fontSize: 11, color: "#cbd5e1" },

  resultList: { borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  resultIndex: { fontSize: 11, color: "#94a3b8", minWidth: 16 },
  resultContent: { flex: 1 },
  resultTitle: { fontSize: 12, fontWeight: "500", color: PRIMARY, marginBottom: 2 },
  resultSource: { fontSize: 11, color: "#94a3b8" },
})
