import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, Image, StyleSheet } from "react-native";
import { fetchMostPlayedAgainst } from "../lib/startggApi";
import { getFighterIcon, resolveFighterName } from "../data/smashFighters";

export default function RecentCharactersCard({ playerId, accessToken, onSelectCharacter, showAll, onShowAll, refreshKey }) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const chars = await fetchMostPlayedAgainst(playerId, accessToken);
        if (mounted) setCharacters(chars);
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (playerId && accessToken) load();
    return () => { mounted = false; };
  }, [playerId, accessToken, refreshKey]);

  return (
    <>
      <View style={styles.dashboardCardHeader}>
        <Text style={styles.dashboardCardTitle}>Most Played Against</Text>
        <Text style={styles.dashboardCardMeta}>{characters.length} character{characters.length !== 1 ? "s" : ""}</Text>
      </View>

      {loading ? (
        <View style={styles.syncRow}>
          <ActivityIndicator size="small" color="#FF6B3D" />
          <Text style={styles.syncLabel}>Loading matchup data...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Error</Text>
          <Text style={styles.emptyBody}>{error}</Text>
        </View>
      ) : characters.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitleDark}>No matchup data found</Text>
          <Text style={styles.emptyBody}>Play some tournament sets to see your most common matchups.</Text>
        </View>
      ) : (
        <>
          <View style={styles.listWrap}>
            {(showAll ? characters : characters.slice(0, 3)).map((char) => {
              const resolved = resolveFighterName(char.name);
              const icon = getFighterIcon(resolved);
              return (
                <View key={char.name} style={styles.itemWrap}>
                  <View style={styles.itemRow}>
                    <Image source={icon} style={styles.characterIcon} resizeMode="contain" />
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{resolved}</Text>
                      <Text style={styles.itemMeta}>{char.sets} set{char.sets !== 1 ? "s" : ""}</Text>
                    </View>
                    <Pressable
                      style={styles.viewNotesBtn}
                      onPress={() => onSelectCharacter && onSelectCharacter(resolved)}
                    >
                      <Text style={styles.viewNotesBtnLabel}>View Notes</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
          {!showAll && characters.length > 3 && onShowAll ? (
            <Pressable style={styles.showAllBtn} onPress={onShowAll}>
              <Text style={styles.showAllBtnLabel}>Show All ({characters.length})</Text>
            </Pressable>
          ) : null}
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
  listWrap: {
    gap: 10,
  },
  itemWrap: {
    backgroundColor: "#232B3A",
    borderRadius: 10,
    padding: 14,
  },
  itemRow: {
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
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: "#F4F7FF",
    fontWeight: "700",
    fontSize: 16,
  },
  itemMeta: {
    color: "#96A3BD",
    fontSize: 12,
    marginTop: 2,
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
    color: "#1A2B48",
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
    marginTop: 12,
    alignSelf: "center",
    backgroundColor: "#2A3449",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  showAllBtnLabel: {
    color: "#FF6B3D",
    fontWeight: "700",
    fontSize: 14,
  },
});
