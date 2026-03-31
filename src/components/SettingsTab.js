import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, Platform, StyleSheet } from "react-native";
import SelectMenuButton from "./SelectMenuButton";
import { saveNotes } from "../utils/storage";

export default function SettingsTab({
  startggUser,
  startggIsAuthenticated,
  startggLogin,
  startggLogout,
  userMainCharacter,
  onSetMainCharacter,
  mainMenuOptions,
  isMainSaving,
  onSignOut,
  allNotes,
  userId,
  session,
}) {
  const [clearing, setClearing] = useState(false);

  const email = session?.user?.email || "Unknown";
  const noteCount = (allNotes || []).length;
  const playerCount = new Set((allNotes || []).map((n) => n.playerTag).filter(Boolean)).size;
  const charCount = new Set((allNotes || []).map((n) => n.character).filter((c) => c && c !== "General")).size;

  function handleExportNotes() {
    try {
      const data = JSON.stringify(allNotes || [], null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smashnotes-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      Alert.alert("Export Failed", err.message || "Could not export notes.");
    }
  }

  async function handleClearCache() {
    if (Platform.OS === "web") {
      if (!window.confirm("Clear local cache? Your cloud notes will be re-downloaded on next load.")) return;
    } else {
      // On native use Alert
      return new Promise((resolve) => {
        Alert.alert("Clear Cache", "Clear local cache? Your cloud notes will be re-downloaded on next load.", [
          { text: "Cancel", style: "cancel", onPress: () => resolve() },
          { text: "Clear", style: "destructive", onPress: async () => {
            setClearing(true);
            await saveNotes([], userId);
            setClearing(false);
            resolve();
          }},
        ]);
      });
    }
    setClearing(true);
    await saveNotes([], userId);
    setClearing(false);
  }

  const MAIN_NONE_VALUE = "__none__";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={styles.rowValue}>{email}</Text>
        </View>
        <Pressable style={styles.dangerBtn} onPress={onSignOut}>
          <Text style={styles.dangerBtnLabel}>Sign Out</Text>
        </Pressable>
      </View>

      {/* Start.gg */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Start.gg Connection</Text>
        {startggIsAuthenticated && startggUser ? (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Gamer Tag</Text>
              <Text style={styles.rowValueHighlight}>
                {startggUser.player?.gamerTag || startggUser.name || "Connected"}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Status</Text>
              <View style={styles.statusChip}>
                <View style={styles.statusDot} />
                <Text style={styles.statusLabel}>Connected</Text>
              </View>
            </View>
            <Pressable style={styles.secondaryBtn} onPress={startggLogout}>
              <Text style={styles.secondaryBtnLabel}>Disconnect Start.gg</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.description}>
              Connect your Start.gg account to see your stats, recent opponents, and matchup data.
            </Text>
            <Pressable style={styles.primaryBtn} onPress={startggLogin}>
              <Text style={styles.primaryBtnLabel}>Connect Start.gg</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Main Character */}
      <View style={[styles.section, { zIndex: 100 }]}>
        <Text style={styles.sectionTitle}>Main Character</Text>
        <Text style={styles.description}>
          Your main character is shown on the dashboard and used as the default when creating notes.
        </Text>
        <SelectMenuButton
          value={userMainCharacter || MAIN_NONE_VALUE}
          options={mainMenuOptions}
          onSelect={(v) => onSetMainCharacter(v === MAIN_NONE_VALUE ? null : v)}
          disabled={isMainSaving}
          searchable
          searchPlaceholder="Search characters..."
          anchorStyle={styles.mainAnchor}
          buttonStyle={styles.mainBtn}
          labelStyle={styles.mainBtnLabel}
          caretStyle={styles.mainBtnCaret}
          dropdownStyle={styles.mainDropdown}
          listStyle={styles.mainList}
          itemStyle={styles.mainItem}
          itemActiveStyle={styles.mainItemActive}
          itemLabelStyle={styles.mainItemLabel}
          maxListHeight={220}
        />
        {isMainSaving && <Text style={styles.savingText}>Saving...</Text>}
      </View>

      {/* Data Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{noteCount}</Text>
            <Text style={styles.statLabel}>Notes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{charCount}</Text>
            <Text style={styles.statLabel}>Characters</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{playerCount}</Text>
            <Text style={styles.statLabel}>Players</Text>
          </View>
        </View>

        <Pressable style={styles.secondaryBtn} onPress={handleExportNotes}>
          <Text style={styles.secondaryBtnLabel}>Export Notes (JSON)</Text>
        </Pressable>

        <Pressable
          style={[styles.outlineBtn, clearing && { opacity: 0.5 }]}
          onPress={handleClearCache}
          disabled={clearing}
        >
          <Text style={styles.outlineBtnLabel}>
            {clearing ? "Clearing..." : "Clear Local Cache"}
          </Text>
        </Pressable>
      </View>

      {/* App Info */}
      <View style={styles.footerWrap}>
        <Text style={styles.footerText}>SmashNotes</Text>
        <Text style={styles.footerVersion}>v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  section: {
    backgroundColor: "#1B2333",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A3449",
  },
  sectionTitle: {
    color: "#F4F7FF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  description: {
    color: "#96A3BD",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2A3449",
  },
  rowLabel: { color: "#96A3BD", fontSize: 14, fontWeight: "600" },
  rowValue: { color: "#ECF2FF", fontSize: 14, fontWeight: "600" },
  rowValueHighlight: { color: "#FF6B3D", fontSize: 14, fontWeight: "700" },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1A3A2A",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34D399",
  },
  statusLabel: { color: "#34D399", fontSize: 12, fontWeight: "700" },
  primaryBtn: {
    backgroundColor: "#FF6B3D",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnLabel: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondaryBtn: {
    backgroundColor: "#2A3449",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryBtnLabel: { color: "#ECF2FF", fontWeight: "700", fontSize: 14 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: "#3A4A66",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  outlineBtnLabel: { color: "#96A3BD", fontWeight: "700", fontSize: 14 },
  dangerBtn: {
    backgroundColor: "#4A2930",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  dangerBtnLabel: { color: "#F87171", fontWeight: "800", fontSize: 14 },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#141C2B",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  statNumber: { color: "#FF6B3D", fontSize: 28, fontWeight: "800" },
  statLabel: { color: "#96A3BD", fontSize: 11, fontWeight: "700", marginTop: 4 },
  mainAnchor: { marginTop: 4, zIndex: 200 },
  mainBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#344158",
    backgroundColor: "#141C2B",
    paddingHorizontal: 12,
  },
  mainBtnLabel: { color: "#ECF2FF", fontSize: 13, fontWeight: "700" },
  mainBtnCaret: { color: "#C9D4E8", fontSize: 11, fontWeight: "900" },
  mainDropdown: {
    top: 48,
    left: 0,
    right: 0,
    borderColor: "#344158",
    backgroundColor: "#141C2B",
    zIndex: 9999,
  },
  mainList: { maxHeight: 220 },
  mainItem: { paddingHorizontal: 12, paddingVertical: 9 },
  mainItemActive: { backgroundColor: "#20334B" },
  mainItemLabel: { color: "#ECF2FF", fontSize: 12, fontWeight: "700" },
  savingText: { color: "#96A3BD", fontSize: 12, marginTop: 6 },
  footerWrap: { alignItems: "center", paddingVertical: 24 },
  footerText: { color: "#3A4A66", fontSize: 14, fontWeight: "800" },
  footerVersion: { color: "#2A3449", fontSize: 12, marginTop: 4 },
});
