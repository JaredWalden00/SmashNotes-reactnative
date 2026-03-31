import React, { useState, useMemo } from "react";
import { View, Text, Pressable, TextInput, ScrollView, Image, StyleSheet } from "react-native";
import { getFighterIcon } from "../data/smashFighters";
import NoteItem from "./NoteItem";

export default function PlayersTab({ allNotes, onEditNote, onDeleteNote, onSaveInlineEdit }) {
  const [search, setSearch] = useState("");
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  const players = useMemo(() => {
    const map = {};
    for (const note of (allNotes || [])) {
      const tag = note.playerTag;
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (!map[key]) {
        map[key] = {
          tag,
          notes: [],
          characters: new Set(),
          lastUpdated: 0,
        };
      }
      map[key].notes.push(note);
      if (note.character && note.character !== "General") {
        map[key].characters.add(note.character);
      }
      if (note.updatedAt > map[key].lastUpdated) {
        map[key].lastUpdated = note.updatedAt;
      }
    }
    return Object.values(map)
      .map((p) => ({ ...p, characters: Array.from(p.characters) }))
      .sort((a, b) => b.notes.length - a.notes.length);
  }, [allNotes]);

  const filtered = useMemo(() => {
    if (!search.trim()) return players;
    const q = search.trim().toLowerCase();
    return players.filter((p) => p.tag.toLowerCase().includes(q));
  }, [players, search]);

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search players..."
        placeholderTextColor="#8A93A7"
      />

      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>
            {players.length === 0 ? "No players tracked" : "No matching players"}
          </Text>
          <Text style={styles.emptyBody}>
            {players.length === 0
              ? "Assign a player tag to a note to start tracking opponents here."
              : "Try a different search term."}
          </Text>
        </View>
      ) : (
        filtered.map((player) => {
          const isExpanded = expandedPlayer === player.tag.toLowerCase();

          return (
            <View key={player.tag.toLowerCase()} style={styles.playerCard}>
              <Pressable
                style={styles.playerHeader}
                onPress={() => setExpandedPlayer(isExpanded ? null : player.tag.toLowerCase())}
              >
                <View style={styles.playerIconWrap}>
                  {player.characters[0] ? (
                    <Image source={getFighterIcon(player.characters[0])} style={styles.playerIcon} resizeMode="contain" />
                  ) : (
                    <View style={styles.playerIconPlaceholder}>
                      <Text style={styles.playerIconText}>{player.tag[0].toUpperCase()}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerTag}>{player.tag}</Text>
                  <View style={styles.playerMeta}>
                    <Text style={styles.playerMetaText}>
                      {player.notes.length} note{player.notes.length !== 1 ? "s" : ""}
                    </Text>
                    {player.characters.length > 0 && (
                      <Text style={styles.playerMetaText}>
                        {player.characters.join(", ")}
                      </Text>
                    )}
                    <Text style={styles.playerMetaDate}>
                      Updated {formatDate(player.lastUpdated)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.expandIcon}>{isExpanded ? "▲" : "▼"}</Text>
              </Pressable>

              {isExpanded && (
                <View style={styles.playerNotes}>
                  {player.notes
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map((note) => (
                      <NoteItem
                        key={note.id}
                        note={note}
                        onEdit={onEditNote}
                        onDelete={onDeleteNote}
                        onSave={onSaveInlineEdit}
                        forceDark
                        compact
                      />
                    ))}
                </View>
              )}
            </View>
          );
        })
      )}

      <View style={styles.totalWrap}>
        <Text style={styles.totalText}>
          {players.length} player{players.length !== 1 ? "s" : ""} tracked
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  search: {
    backgroundColor: "#1B2333",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
    color: "#ECF2FF",
    marginBottom: 16,
    fontSize: 14,
  },
  emptyWrap: { justifyContent: "center", alignItems: "center", padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: "#F4F7FF", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  emptyBody: { color: "#96A3BD", fontSize: 14, textAlign: "center", lineHeight: 22 },
  playerCard: {
    backgroundColor: "#1B2333",
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
    overflow: "hidden",
  },
  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  playerIconWrap: {},
  playerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#141C2B",
  },
  playerIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2A4D9B",
    justifyContent: "center",
    alignItems: "center",
  },
  playerIconText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  playerInfo: { flex: 1 },
  playerTag: { color: "#F4F7FF", fontSize: 17, fontWeight: "800" },
  playerMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  playerMetaText: { color: "#96A3BD", fontSize: 12 },
  playerMetaDate: { color: "#637083", fontSize: 12 },
  expandIcon: { color: "#637083", fontSize: 12, fontWeight: "800" },
  playerNotes: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: "#2A3449",
  },
  totalWrap: { alignItems: "center", paddingVertical: 16 },
  totalText: { color: "#637083", fontSize: 12, fontWeight: "600" },
});
