import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { fetchRecentCharacters } from "../lib/startggApi";
import { getFighterIcon } from "../data/smashFighters";
import { StyleSheet } from "react-native";

import { Pressable } from "react-native";

export default function RecentCharactersCard({ playerId, accessToken, onSelectCharacter }) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const chars = await fetchRecentCharacters(playerId, accessToken);
        if (mounted) setCharacters(chars);
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (playerId && accessToken) load();
    return () => { mounted = false; };
  }, [playerId, accessToken]);

  return (
    <>
      <View style={styles.dashboardCardHeader}>
        <Text style={styles.dashboardCardTitle}>Recent Characters Played</Text>
        <Text style={styles.dashboardCardMeta}>{characters.length} shown</Text>
      </View>

      {loading ? (
        <View style={styles.syncRow}>
          <ActivityIndicator size="small" color="#FF6B3D" />
          <Text style={styles.syncLabel}>Loading characters...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Error</Text>
          <Text style={styles.emptyBody}>{error}</Text>
        </View>
      ) : (
        <View style={styles.recentNotesWrap}>
          {characters.map((char) => (
            <View key={char.id} style={styles.noteItemWrap}>
              <View style={styles.noteItemHeader}>
                {/* Character icon if available */}
                {getFighterIcon(char.name) ? (
                  <Image
                    source={getFighterIcon(char.name)}
                    style={styles.characterIcon}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.characterIconPlaceholder} />
                )}
                <View style={styles.noteItemHeaderText}>
                  <Text style={styles.noteItemTitle}>{char.name}</Text>
                  {char.gameName ? (
                    <Text style={styles.noteItemMeta}>{char.gameName}</Text>
                  ) : null}
                </View>
                <Pressable
                  style={styles.viewNotesBtn}
                  onPress={() => onSelectCharacter && onSelectCharacter(char.name)}
                >
                  <Text style={styles.viewNotesBtnLabel}>View Notes</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
      {!loading && !characters.length && !error ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No recent characters found</Text>
          <Text style={styles.emptyBody}>Play some games to see your recent characters here.</Text>
        </View>
      ) : null}
    </>
  );
}

import { Image } from "react-native";

const styles = StyleSheet.create({
      viewNotesBtn: {
        marginLeft: 8,
        backgroundColor: '#FF6B3D',
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        alignSelf: 'center',
      },
      viewNotesBtnLabel: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
      },
    characterIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginRight: 12,
      backgroundColor: "#1A2438",
    },
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
  recentNotesWrap: {
    gap: 10,
  },
  noteItemWrap: {
    backgroundColor: "#232B3A",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  noteItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  characterIconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A2438",
    marginRight: 12,
  },
  noteItemHeaderText: {
    flex: 1,
  },
  noteItemTitle: {
    color: "#F4F7FF",
    fontWeight: "700",
    fontSize: 16,
  },
  noteItemMeta: {
    color: "#96A3BD",
    fontSize: 13,
    marginTop: 2,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontWeight: "700",
    fontSize: 20,
    color: "#1A2B48",
    marginBottom: 8,
  },
  emptyBody: {
    textAlign: "center",
    color: "#637083",
    lineHeight: 21,
  },
});
