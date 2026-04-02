import React, { useState, useMemo } from "react";
import { View, Text, Pressable, TextInput, ScrollView, Image, StyleSheet } from "react-native";
import { getFrameData, getFrameDataCharacters, getUfdUrl } from "../utils/frameData";
import { getFighterIcon } from "../data/smashFighters";
import SelectMenuButton from "./SelectMenuButton";

const CATEGORY_COLORS = {
  groundattacks: "#FF6B3D",
  aerialattacks: "#6B9CFF",
  specialattacks: "#34D399",
  grabs: "#F59E0B",
  dodges: "#A78BFA",
};

export default function FrameDataTab() {
  const [selectedChar, setSelectedChar] = useState(null);
  const [search, setSearch] = useState("");
  const [expandedCat, setExpandedCat] = useState(null);

  const characters = useMemo(() => getFrameDataCharacters(), []);
  const charOptions = useMemo(() => [
    { label: "Select a character...", value: "__none__" },
    ...characters.map((name) => ({ label: name, value: name })),
  ], [characters]);

  const frameData = selectedChar ? getFrameData(selectedChar) : null;
  const ufdUrl = selectedChar ? getUfdUrl(selectedChar) : null;

  const filteredCategories = useMemo(() => {
    if (!frameData) return [];
    if (!search.trim()) return frameData.categories;
    const q = search.trim().toLowerCase();
    return frameData.categories
      .map((cat) => ({
        ...cat,
        moves: cat.moves.filter(
          (m) =>
            m.moveName.toLowerCase().includes(q) ||
            (m.notes && m.notes.toLowerCase().includes(q))
        ),
      }))
      .filter((cat) => cat.moves.length > 0);
  }, [frameData, search]);

  // Character grid when nothing is selected
  if (!selectedChar) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerSection}>
          <Text style={styles.pageTitle}>Frame Data</Text>
          <Text style={styles.pageMeta}>Data from ultimateframedata.com — {characters.length} characters</Text>
        </View>
        <View style={styles.charGrid}>
          {characters.map((name) => (
            <Pressable key={name} style={styles.charTile} onPress={() => { setSelectedChar(name); setSearch(""); setExpandedCat(null); }}>
              <Image source={getFighterIcon(name)} style={styles.charIcon} resizeMode="contain" />
              <Text style={styles.charName} numberOfLines={1}>{name}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Character header */}
      <View style={styles.charHeader}>
        <Pressable style={styles.backBtn} onPress={() => { setSelectedChar(null); setSearch(""); }}>
          <Text style={styles.backBtnLabel}>← All Characters</Text>
        </Pressable>
        <View style={styles.charHeaderInfo}>
          <Image source={getFighterIcon(selectedChar)} style={styles.charHeaderIcon} resizeMode="contain" />
          <View>
            <Text style={styles.charHeaderName}>{selectedChar}</Text>
            {ufdUrl && (
              <Pressable onPress={() => { if (typeof window !== "undefined") window.open(ufdUrl, "_blank"); }}>
                <Text style={styles.ufdLink}>View on ultimateframedata.com</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder={`Search ${selectedChar} moves...`}
        placeholderTextColor="#637083"
      />

      {/* Categories */}
      {filteredCategories.map((cat) => {
        const isExpanded = expandedCat === cat.category || search.trim();
        const accentColor = CATEGORY_COLORS[cat.category] || "#FF6B3D";

        return (
          <View key={cat.category} style={styles.catSection}>
            <Pressable
              style={styles.catHeader}
              onPress={() => setExpandedCat(expandedCat === cat.category ? null : cat.category)}
            >
              <View style={[styles.catDot, { backgroundColor: accentColor }]} />
              <Text style={styles.catTitle}>{cat.label}</Text>
              <Text style={styles.catCount}>{cat.moves.length}</Text>
              <Text style={styles.catChevron}>{isExpanded ? "▲" : "▼"}</Text>
            </Pressable>

            {isExpanded && cat.moves.map((move, i) => (
              <View key={`${move.moveName}-${i}`} style={styles.moveCard}>
                <Text style={[styles.moveName, { color: accentColor }]}>{move.moveName}</Text>
                {move.whichHitbox && move.whichHitbox !== "--" && (
                  <Text style={styles.moveHitbox}>{move.whichHitbox}</Text>
                )}
                <View style={styles.moveStatsGrid}>
                  {move.startup && move.startup !== "--" && (
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Startup</Text>
                      <Text style={styles.statValue}>{move.startup}</Text>
                    </View>
                  )}
                  {move.activeFrames && move.activeFrames !== "--" && (
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Active</Text>
                      <Text style={styles.statValue}>{move.activeFrames}</Text>
                    </View>
                  )}
                  {move.totalFrames && move.totalFrames !== "--" && (
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Total</Text>
                      <Text style={styles.statValue}>{move.totalFrames}</Text>
                    </View>
                  )}
                  {move.baseDamage && move.baseDamage !== "--" && (
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Damage</Text>
                      <Text style={styles.statValue}>{move.baseDamage}%</Text>
                    </View>
                  )}
                  {move.advantage && move.advantage !== "--" && (
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Advantage</Text>
                      <Text style={[styles.statValue, parseInt(move.advantage) >= 0 ? styles.statPositive : styles.statNegative]}>
                        {move.advantage}
                      </Text>
                    </View>
                  )}
                  {move.landingLag && move.landingLag !== "--" && (
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Land Lag</Text>
                      <Text style={styles.statValue}>{move.landingLag}</Text>
                    </View>
                  )}
                  {move.shieldLag && move.shieldLag !== "--" && (
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Shield Lag</Text>
                      <Text style={styles.statValue}>{move.shieldLag}</Text>
                    </View>
                  )}
                  {move.shieldStun && move.shieldStun !== "--" && (
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Shield Stun</Text>
                      <Text style={styles.statValue}>{move.shieldStun}</Text>
                    </View>
                  )}
                </View>
                {move.notes ? (
                  <Text style={styles.moveNotes}>{move.notes}</Text>
                ) : null}
              </View>
            ))}
          </View>
        );
      })}

      {filteredCategories.length === 0 && search.trim() && (
        <Text style={styles.noResults}>No moves match "{search}"</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  headerSection: { marginBottom: 16 },
  pageTitle: { color: "#F4F7FF", fontSize: 24, fontWeight: "800" },
  pageMeta: { color: "#96A3BD", fontSize: 13, marginTop: 4 },
  charGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  charTile: {
    width: 90,
    alignItems: "center",
    backgroundColor: "#1B2333",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#2A3449",
  },
  charIcon: { width: 48, height: 48, marginBottom: 6 },
  charName: { color: "#ECF2FF", fontSize: 11, fontWeight: "600", textAlign: "center" },
  charHeader: {
    marginBottom: 16,
  },
  backBtn: { marginBottom: 12 },
  backBtnLabel: { color: "#6B9CFF", fontSize: 13, fontWeight: "700" },
  charHeaderInfo: { flexDirection: "row", alignItems: "center", gap: 14 },
  charHeaderIcon: { width: 56, height: 56 },
  charHeaderName: { color: "#F4F7FF", fontSize: 24, fontWeight: "800" },
  ufdLink: { color: "#FF6B3D", fontSize: 12, fontWeight: "600", marginTop: 2 },
  searchInput: {
    backgroundColor: "#1B2333",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#2A3449",
    color: "#ECF2FF",
    fontSize: 14,
    marginBottom: 16,
  },
  catSection: {
    backgroundColor: "#1B2333",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
    overflow: "hidden",
  },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catTitle: { color: "#F4F7FF", fontSize: 16, fontWeight: "800", flex: 1 },
  catCount: { color: "#96A3BD", fontSize: 12, fontWeight: "700" },
  catChevron: { color: "#637083", fontSize: 12 },
  moveCard: {
    padding: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#2A3449",
  },
  moveName: { fontWeight: "800", fontSize: 14, marginBottom: 6 },
  moveHitbox: { color: "#96A3BD", fontSize: 11, marginBottom: 6, fontStyle: "italic" },
  moveStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statCell: {
    backgroundColor: "#141C2B",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: "center",
    minWidth: 70,
  },
  statLabel: { color: "#637083", fontSize: 10, fontWeight: "600" },
  statValue: { color: "#ECF2FF", fontSize: 14, fontWeight: "800" },
  statPositive: { color: "#34D399" },
  statNegative: { color: "#F87171" },
  moveNotes: { color: "#96A3BD", fontSize: 12, marginTop: 8, lineHeight: 18, fontStyle: "italic" },
  noResults: { color: "#637083", fontSize: 13, textAlign: "center", marginTop: 20, fontStyle: "italic" },
});
