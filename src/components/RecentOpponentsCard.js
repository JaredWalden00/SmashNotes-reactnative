import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, Image, StyleSheet } from "react-native";
import { fetchRecentOpponents } from "../lib/startggApi";
import { getFighterIcon, resolveFighterName } from "../data/smashFighters";

function dedupeByTag(opponents) {
  const seen = new Set();
  return opponents.filter((opp) => {
    const key = opp.gamerTag.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function RecentOpponentsCard({ playerId, accessToken, notes, onSelectOpponent, onShowAll, refreshKey, maxShown = 4 }) {
  const [opponents, setOpponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const opps = await fetchRecentOpponents(playerId, accessToken);
        if (mounted) setOpponents(opps);
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (playerId && accessToken) load();
    return () => { mounted = false; };
  }, [playerId, accessToken, refreshKey]);

  function getNotesCountForOpponent(opponent) {
    if (!notes || !notes.length) return 0;
    return notes.filter(
      (n) =>
        (n.startggPlayerId && String(n.startggPlayerId) === String(opponent.playerId)) ||
        (n.playerTag && n.playerTag.toLowerCase() === opponent.gamerTag.toLowerCase())
    ).length;
  }

  return (
    <>
      <View style={styles.dashboardCardHeader}>
        <Text style={styles.dashboardCardTitle}>Recent Opponents</Text>
        <Text style={styles.dashboardCardMeta}>{opponents.length} shown</Text>
      </View>

      {loading ? (
        <View style={styles.syncRow}>
          <ActivityIndicator size="small" color="#FF6B3D" />
          <Text style={styles.syncLabel}>Loading opponents...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Error</Text>
          <Text style={styles.emptyBody}>{error}</Text>
        </View>
      ) : opponents.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitleDark}>No recent opponents found</Text>
          <Text style={styles.emptyBody}>Play some tournament sets to see your opponents here.</Text>
        </View>
      ) : (
        <>
        <View style={styles.opponentsWrap}>
          {dedupeByTag(opponents).slice(0, maxShown).map((opp) => {
            const noteCount = getNotesCountForOpponent(opp);
            const topChar = opp.characters[0] ? resolveFighterName(opp.characters[0]) : null;
            const iconSource = getFighterIcon(topChar) || getFighterIcon(null);

            return (
              <View key={opp.gamerTag} style={styles.opponentCard}>
                <View style={styles.opponentRow}>
                  <Image source={iconSource} style={styles.characterIcon} resizeMode="contain" />
                  <View style={styles.opponentInfo}>
                    <Text style={styles.gamerTag}>{opp.gamerTag}</Text>
                    <View style={styles.metaRow}>
                      {topChar ? (
                        <Text style={styles.metaText}>
                          {opp.characters.map(resolveFighterName).join(", ")}
                        </Text>
                      ) : null}
                      {noteCount > 0 ? (
                        <Text style={styles.noteCountBadge}>
                          {noteCount} note{noteCount !== 1 ? "s" : ""}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    style={styles.viewNotesBtn}
                    onPress={() => onSelectOpponent && onSelectOpponent(opp)}
                  >
                    <Text style={styles.viewNotesBtnLabel}>
                      {noteCount > 0 ? "View Notes" : "Add Note"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
        {dedupeByTag(opponents).length > maxShown && onShowAll && (
          <Pressable style={styles.showAllBtn} onPress={onShowAll}>
            <Text style={styles.showAllBtnLabel}>View All Opponents ({dedupeByTag(opponents).length})</Text>
          </Pressable>
        )}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  dashboardCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  dashboardCardTitle: {
    color: "#F4F7FF",
    fontSize: 20,
    fontWeight: "800",
  },
  dashboardCardMeta: {
    color: "#96A3BD",
    fontSize: 12,
    fontWeight: "700",
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  syncLabel: {
    color: "#637083",
    fontSize: 13,
  },
  opponentsWrap: {
    gap: 10,
  },
  opponentCard: {
    backgroundColor: "#232B3A",
    borderRadius: 10,
    padding: 14,
  },
  opponentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  characterIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: "#1A2438",
  },
  characterIconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A2438",
    marginRight: 12,
  },
  opponentInfo: {
    flex: 1,
  },
  gamerTag: {
    color: "#F4F7FF",
    fontWeight: "700",
    fontSize: 16,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  metaText: {
    color: "#96A3BD",
    fontSize: 12,
  },
  noteCountBadge: {
    color: "#FF6B3D",
    fontSize: 12,
    fontWeight: "700",
  },
  viewNotesBtn: {
    marginLeft: 8,
    backgroundColor: "#FF6B3D",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "center",
  },
  viewNotesBtnLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  emptyWrap: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: "#C9D4E8",
    marginBottom: 6,
  },
  emptyTitleDark: {
    fontWeight: "700",
    fontSize: 16,
    color: "#C9D4E8",
    marginBottom: 6,
  },
  emptyBody: {
    textAlign: "center",
    color: "#637083",
    lineHeight: 21,
    fontSize: 13,
  },
  showAllBtn: {
    marginTop: 10,
    alignSelf: "center",
    backgroundColor: "#2A3449",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  showAllBtnLabel: {
    color: "#FF6B3D",
    fontWeight: "700",
    fontSize: 13,
  },
});
