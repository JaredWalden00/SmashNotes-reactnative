import React, { useEffect, useState, useMemo, useCallback } from "react";
import { View, Text, ActivityIndicator, ScrollView, Image, Pressable, TextInput, StyleSheet } from "react-native";
import { fetchSetsPage } from "../lib/startggApi";
import { getFighterIcon, resolveFighterName } from "../data/smashFighters";

function parseResult(set, userEntrantId) {
  const score = set.displayScore || "";
  let won = null;
  if (score) {
    const parts = score.split(" - ");
    if (parts.length === 2) {
      const p1Match = parts[0].match(/(\d+)$/);
      const p2Match = parts[1].match(/(\d+)$/);
      if (p1Match && p2Match) {
        const s1 = parseInt(p1Match[1]);
        const s2 = parseInt(p2Match[1]);
        const userIsFirst = set.slots?.[0]?.entrant?.id && String(set.slots[0].entrant.id) === userEntrantId;
        won = userIsFirst ? s1 > s2 : s2 > s1;
      }
    }
  }
  return won;
}

export default function StatsTab({ playerId, accessToken, onCreateSetNote }) {
  const [allSets, setAllSets] = useState([]);
  const [gamerTag, setGamerTag] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const loadPage = useCallback(async (pageNum, append = false) => {
    if (!playerId || !accessToken) return;
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const result = await fetchSetsPage(playerId, accessToken, pageNum, 20);
      if (!gamerTag && result.gamerTag) setGamerTag(result.gamerTag);
      setAllSets((prev) => append ? [...prev, ...result.sets] : result.sets);
      setHasMore(result.hasMore);
      setPage(pageNum);
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [playerId, accessToken, gamerTag]);

  useEffect(() => {
    loadPage(1);
  }, [playerId, accessToken]);

  function handleLoadMore() {
    if (!loadingMore && hasMore) {
      loadPage(page + 1, true);
    }
  }

  // Process all sets into results
  const { yourChars, opponentChars, results } = useMemo(() => {
    const yc = {};
    const oc = {};
    const res = [];

    for (const set of allSets) {
      if (!set.slots) continue;

      let userEntrantId = null;
      let oppGamerTag = "Unknown";
      if (gamerTag) {
        const tagLower = gamerTag.toLowerCase();
        for (const slot of set.slots) {
          const match = slot.entrant?.participants?.some(
            (p) => p.gamerTag?.toLowerCase() === tagLower
          ) || slot.entrant?.name?.toLowerCase().includes(tagLower);
          if (match && slot.entrant?.id) {
            userEntrantId = String(slot.entrant.id);
            break;
          }
        }
      }
      for (const slot of set.slots) {
        if (slot.entrant?.id && String(slot.entrant.id) !== userEntrantId) {
          oppGamerTag = slot.entrant?.participants?.[0]?.gamerTag || "Unknown";
        }
      }
      if (!userEntrantId) continue;

      const won = parseResult(set, userEntrantId);

      res.push({
        id: set.id,
        opponent: oppGamerTag,
        score: set.displayScore || "",
        won,
        tournament: set.event?.tournament?.name || "",
        event: set.event?.name || "",
      });

      if (set.games) {
        for (const game of set.games) {
          for (const sel of game.selections || []) {
            if (!sel.character?.name || !sel.entrant?.id) continue;
            const charName = resolveFighterName(sel.character.name);
            if (String(sel.entrant.id) === userEntrantId) {
              yc[charName] = (yc[charName] || 0) + 1;
            } else {
              oc[charName] = (oc[charName] || 0) + 1;
            }
          }
        }
      }
    }
    return { yourChars: yc, opponentChars: oc, results: res };
  }, [allSets, gamerTag]);

  // Filter results by search
  const filteredResults = useMemo(() => {
    if (!search.trim()) return results;
    const q = search.trim().toLowerCase();
    return results.filter(
      (r) =>
        r.opponent.toLowerCase().includes(q) ||
        r.tournament.toLowerCase().includes(q) ||
        r.event.toLowerCase().includes(q)
    );
  }, [results, search]);

  if (!playerId || !accessToken) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyTitle}>Connect Start.gg</Text>
        <Text style={styles.emptyBody}>Connect your Start.gg account in Settings to see your character stats, matchup data, and recent results.</Text>
      </View>
    );
  }

  if (loading && allSets.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#FF6B3D" />
        <Text style={styles.loadingText}>Loading stats...</Text>
      </View>
    );
  }

  if (error && allSets.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Error</Text>
        <Text style={styles.emptyBody}>{error}</Text>
      </View>
    );
  }

  const sortedYourChars = Object.entries(yourChars).sort((a, b) => b[1] - a[1]);
  const sortedOppChars = Object.entries(opponentChars).sort((a, b) => b[1] - a[1]);
  const maxYourCount = sortedYourChars[0]?.[1] || 1;
  const maxOppCount = sortedOppChars[0]?.[1] || 1;
  const wins = results.filter((r) => r.won === true).length;
  const losses = results.filter((r) => r.won === false).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Overview */}
      <View style={styles.overviewRow}>
        <View style={styles.overviewBox}>
          <Text style={styles.overviewNumber}>{results.length}</Text>
          <Text style={styles.overviewLabel}>Sets</Text>
        </View>
        <View style={styles.overviewBox}>
          <Text style={[styles.overviewNumber, { color: "#34D399" }]}>{wins}</Text>
          <Text style={styles.overviewLabel}>Wins</Text>
        </View>
        <View style={styles.overviewBox}>
          <Text style={[styles.overviewNumber, { color: "#F87171" }]}>{losses}</Text>
          <Text style={styles.overviewLabel}>Losses</Text>
        </View>
        <View style={styles.overviewBox}>
          <Text style={styles.overviewNumber}>{wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0}%</Text>
          <Text style={styles.overviewLabel}>Win Rate</Text>
        </View>
      </View>

      {/* Your Characters */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Characters</Text>
        <Text style={styles.sectionMeta}>{sortedYourChars.length} character{sortedYourChars.length !== 1 ? "s" : ""} across {results.length} sets</Text>
        {sortedYourChars.length === 0 ? (
          <Text style={styles.noData}>No character data available</Text>
        ) : (
          sortedYourChars.map(([name, count]) => (
            <View key={name} style={styles.statRow}>
              <Image source={getFighterIcon(name)} style={styles.statIcon} resizeMode="contain" />
              <Text style={styles.statName}>{name}</Text>
              <View style={styles.barWrap}>
                <View style={[styles.bar, { width: `${(count / maxYourCount) * 100}%` }]} />
              </View>
              <Text style={styles.statCount}>{count}</Text>
            </View>
          ))
        )}
      </View>

      {/* Matchup Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Played Against</Text>
        <Text style={styles.sectionMeta}>Opponent characters by frequency</Text>
        {sortedOppChars.length === 0 ? (
          <Text style={styles.noData}>No matchup data available</Text>
        ) : (
          sortedOppChars.map(([name, count]) => (
            <View key={name} style={styles.statRow}>
              <Image source={getFighterIcon(name)} style={styles.statIcon} resizeMode="contain" />
              <Text style={styles.statName}>{name}</Text>
              <View style={styles.barWrap}>
                <View style={[styles.bar, styles.barOpp, { width: `${(count / maxOppCount) * 100}%` }]} />
              </View>
              <Text style={styles.statCount}>{count}</Text>
            </View>
          ))
        )}
      </View>

      {/* Set History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Set History</Text>
        <Text style={styles.sectionMeta}>{filteredResults.length} of {results.length} sets</Text>

        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by opponent or tournament..."
          placeholderTextColor="#637083"
        />

        {filteredResults.length === 0 ? (
          <Text style={styles.noData}>{search.trim() ? "No matching sets" : "No sets found"}</Text>
        ) : (
          filteredResults.map((r) => (
            <View key={r.id} style={styles.resultRow}>
              <View style={[styles.resultIndicator, r.won === true && styles.resultWin, r.won === false && styles.resultLoss]} />
              <View style={styles.resultInfo}>
                <Text style={styles.resultOpponent}>vs {r.opponent}</Text>
                <Text style={styles.resultTournament}>{r.tournament}</Text>
                {r.event ? <Text style={styles.resultEvent}>{r.event}</Text> : null}
              </View>
              <Text style={[styles.resultLabel, r.won === true && styles.resultWinLabel, r.won === false && styles.resultLossLabel]}>
                {r.won === true ? "W" : r.won === false ? "L" : "—"}
              </Text>
              {onCreateSetNote && (
                <Pressable
                  style={styles.setNoteBtn}
                  onPress={() => onCreateSetNote({
                    setId: r.id,
                    setTournament: r.tournament,
                    setEvent: r.event,
                    setScore: r.score,
                    playerTag: r.opponent,
                  })}
                >
                  <Text style={styles.setNoteBtnLabel}>Note</Text>
                </Pressable>
              )}
            </View>
          ))
        )}

        {/* Load More */}
        {hasMore && (
          <Pressable
            style={[styles.loadMoreBtn, loadingMore && { opacity: 0.5 }]}
            onPress={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color="#FF6B3D" />
            ) : (
              <Text style={styles.loadMoreLabel}>Load More Sets</Text>
            )}
          </Pressable>
        )}

        {!hasMore && results.length > 0 && (
          <Text style={styles.endLabel}>All sets loaded</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  loadingText: { color: "#96A3BD", marginTop: 12, fontSize: 14 },
  emptyWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: "#F4F7FF", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  emptyBody: { color: "#96A3BD", fontSize: 14, textAlign: "center", lineHeight: 22 },
  overviewRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  overviewBox: {
    flex: 1,
    backgroundColor: "#1B2333",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A3449",
  },
  overviewNumber: { color: "#FF6B3D", fontSize: 24, fontWeight: "800" },
  overviewLabel: { color: "#96A3BD", fontSize: 11, fontWeight: "700", marginTop: 4 },
  section: {
    backgroundColor: "#1B2333",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A3449",
  },
  sectionTitle: { color: "#F4F7FF", fontSize: 18, fontWeight: "800", marginBottom: 2 },
  sectionMeta: { color: "#96A3BD", fontSize: 12, marginBottom: 14 },
  noData: { color: "#637083", fontSize: 13, fontStyle: "italic" },
  searchInput: {
    backgroundColor: "#141C2B",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#2A3449",
    color: "#ECF2FF",
    fontSize: 14,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  statIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#141C2B" },
  statName: { color: "#ECF2FF", fontSize: 13, fontWeight: "600", width: 110 },
  barWrap: {
    flex: 1,
    height: 8,
    backgroundColor: "#141C2B",
    borderRadius: 4,
    overflow: "hidden",
  },
  bar: {
    height: 8,
    backgroundColor: "#FF6B3D",
    borderRadius: 4,
  },
  barOpp: { backgroundColor: "#6B9CFF" },
  statCount: { color: "#96A3BD", fontSize: 12, fontWeight: "700", width: 30, textAlign: "right" },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141C2B",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  resultIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
    backgroundColor: "#3A4A66",
  },
  resultWin: { backgroundColor: "#34D399" },
  resultLoss: { backgroundColor: "#F87171" },
  resultInfo: { flex: 1 },
  resultOpponent: { color: "#ECF2FF", fontSize: 14, fontWeight: "700" },
  resultTournament: { color: "#96A3BD", fontSize: 12, marginTop: 2 },
  resultEvent: { color: "#637083", fontSize: 11, marginTop: 1 },
  resultLabel: { color: "#637083", fontSize: 16, fontWeight: "800", width: 24, textAlign: "center" },
  resultWinLabel: { color: "#34D399" },
  resultLossLabel: { color: "#F87171" },
  setNoteBtn: {
    backgroundColor: "#2A4D9B",
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginLeft: 8,
  },
  setNoteBtnLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  loadMoreBtn: {
    backgroundColor: "#2A3449",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  loadMoreLabel: {
    color: "#FF6B3D",
    fontWeight: "700",
    fontSize: 14,
  },
  endLabel: {
    color: "#637083",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
});
