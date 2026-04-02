import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { View, Text, Pressable, TextInput, ScrollView, Image, ActivityIndicator, StyleSheet } from "react-native";
import { getFighterIcon, resolveFighterName } from "../data/smashFighters";
import { fetchSetsPage, startggGraphQL } from "../lib/startggApi";
import NoteItem from "./NoteItem";

// Lookup a start.gg user profile by slug
async function lookupStartGGProfile(slug, accessToken) {
  const query = `
    query LookupProfile($slug: String!) {
      user(slug: $slug) {
        id
        slug
        name
        bio
        images {
          type
          url
        }
        location {
          city
          state
          country
        }
        player {
          id
          gamerTag
          prefix
          rankings(videogameId: 1386, limit: 5) {
            id
            rank
            title
          }
        }
        tournaments(query: { perPage: 5 }) {
          nodes {
            id
            name
            startAt
          }
        }
      }
    }
  `;
  try {
    const data = await startggGraphQL(query, { slug }, accessToken);
    return data?.user || null;
  } catch { return null; }
}

function getProfileImage(user) {
  if (!user?.images?.length) return null;
  const profile = user.images.find((img) => img.type === "profile");
  return profile?.url || user.images[0]?.url || null;
}

function getLocationString(user) {
  if (!user?.location) return null;
  const parts = [user.location.city, user.location.state, user.location.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function DragScrollRow({ children, onLoadMore, isLoadingMore }) {
  const scrollRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = useCallback((e) => {
    const el = scrollRef.current;
    if (!el) return;
    isDragging.current = true;
    startX.current = e.clientX;
    scrollLeft.current = el.scrollLeft;
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.clientX - startX.current;
    el.scrollLeft = scrollLeft.current - dx;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    const el = scrollRef.current;
    if (el) {
      el.style.cursor = "grab";
      el.style.userSelect = "";
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !onLoadMore) return;
    // Load more when scrolled within 150px of the right edge
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 150) {
      onLoadMore();
    }
  }, [onLoadMore]);

  return (
    <div
      ref={scrollRef}
      onMouseDown={handleMouseDown}
      onScroll={handleScroll}
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 10,
        overflowX: "auto",
        paddingBottom: 8,
        marginBottom: 12,
        cursor: "grab",
        scrollbarWidth: "thin",
        scrollbarColor: "#2A3449 transparent",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
      {isLoadingMore && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 80,
          padding: 10,
        }}>
          <div style={{
            width: 24,
            height: 24,
            border: "3px solid #2A3449",
            borderTopColor: "#FF6B3D",
            borderRadius: "50%",
            animation: "fd-spin 0.8s linear infinite",
          }} />
          <style>{`@keyframes fd-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}

export default function PlayersTab({ allNotes, onEditNote, onDeleteNote, onSaveInlineEdit, onViewVod, onTrackPlayer, accessToken, playerId }) {
  const [search, setSearch] = useState("");
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [recentOpponents, setRecentOpponents] = useState([]);
  const [opponentsLoading, setOpponentsLoading] = useState(false);
  const [opponentsLoadingMore, setOpponentsLoadingMore] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const opponentMapRef = useRef({});
  const playerGamerTagRef = useRef(null);
  const currentPageRef = useRef(0);
  const hasMoreRef = useRef(true);
  const MAX_PAGES = 5;

  function processSetsBatch(sets) {
    const map = opponentMapRef.current;
    const playerGamerTag = playerGamerTagRef.current;

    for (const set of sets) {
      if (!set.slots) continue;
      let userEntrantId = null;
      if (playerGamerTag) {
        const tagLower = playerGamerTag.toLowerCase();
        for (const slot of set.slots) {
          const match = slot.entrant?.participants?.some(
            (p) => p.gamerTag?.toLowerCase() === tagLower
          ) || slot.entrant?.name?.toLowerCase().includes(tagLower);
          if (match && slot.entrant?.id) { userEntrantId = String(slot.entrant.id); break; }
        }
      }
      if (!userEntrantId) continue;

      for (const slot of set.slots) {
        if (!slot.entrant?.id || String(slot.entrant.id) === userEntrantId) continue;
        const opp = slot.entrant?.participants?.[0];
        if (!opp) continue;
        const key = opp.gamerTag?.toLowerCase() || String(opp.id);
        if (!map[key]) {
          map[key] = { playerId: opp.id, gamerTag: opp.gamerTag || "Unknown", characters: {} };
        }
        const entrantId = String(slot.entrant.id);
        if (set.games) {
          for (const game of set.games) {
            for (const sel of game.selections || []) {
              if (sel.character?.name && String(sel.entrant?.id) === entrantId) {
                map[key].characters[sel.character.name] = (map[key].characters[sel.character.name] || 0) + 1;
              }
            }
          }
        }
      }
    }

    const opps = Object.values(map).map((o) => ({
      ...o,
      characters: Object.entries(o.characters).sort((a, b) => b[1] - a[1]).map(([name]) => name),
    })).sort((a, b) => a.gamerTag.toLowerCase().localeCompare(b.gamerTag.toLowerCase()));

    setRecentOpponents(opps);
  }

  const loadNextPage = useCallback(async () => {
    if (!playerId || !accessToken || !hasMoreRef.current) return;
    const nextPage = currentPageRef.current + 1;
    if (nextPage > MAX_PAGES) { hasMoreRef.current = false; return; }

    const isFirst = nextPage === 1;
    if (isFirst) setOpponentsLoading(true); else setOpponentsLoadingMore(true);

    try {
      const result = await fetchSetsPage(playerId, accessToken, nextPage, 20);
      if (!playerGamerTagRef.current && result.gamerTag) playerGamerTagRef.current = result.gamerTag;
      if (!result.sets.length || !result.hasMore) hasMoreRef.current = false;
      currentPageRef.current = nextPage;
      processSetsBatch(result.sets);
    } catch {
      hasMoreRef.current = false;
    } finally {
      setOpponentsLoading(false);
      setOpponentsLoadingMore(false);
    }
  }, [playerId, accessToken]);

  // Load first page on mount
  useEffect(() => {
    opponentMapRef.current = {};
    playerGamerTagRef.current = null;
    currentPageRef.current = 0;
    hasMoreRef.current = true;
    setRecentOpponents([]);
    loadNextPage();
  }, [playerId, accessToken]);

  // Local players from notes
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
          startggPlayerId: null,
        };
      }
      map[key].notes.push(note);
      if (note.character && note.character !== "General") {
        map[key].characters.add(note.character);
      }
      if (note.updatedAt > map[key].lastUpdated) {
        map[key].lastUpdated = note.updatedAt;
      }
      if (note.startggPlayerId) {
        map[key].startggPlayerId = note.startggPlayerId;
      }
    }
    return Object.values(map)
      .map((p) => ({ ...p, characters: Array.from(p.characters) }))
      .sort((a, b) => b.notes.length - a.notes.length);
  }, [allNotes]);

  const filteredLocal = useMemo(() => {
    if (!search.trim()) return players;
    const q = search.trim().toLowerCase();
    return players.filter((p) => p.tag.toLowerCase().includes(q));
  }, [players, search]);

  // Dedupe and filter recent opponents by search
  const filteredOpponents = useMemo(() => {
    const seen = new Set();
    const deduped = recentOpponents.filter((o) => {
      const key = o.gamerTag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!search.trim()) return deduped;
    const q = search.trim().toLowerCase();
    return deduped.filter((o) => o.gamerTag.toLowerCase().includes(q));
  }, [recentOpponents, search]);

  // Lookup full profile for a player
  const handleViewProfile = useCallback(async (tag) => {
    if (!accessToken) return;
    setProfileLoading(true);
    try {
      // Try slug lookup (lowercase, spaces to hyphens)
      const slug = tag.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const user = await lookupStartGGProfile(slug, accessToken);
      if (user) {
        setSelectedProfile(user);
      } else {
        // No profile found, show a basic card
        setSelectedProfile({ player: { gamerTag: tag }, _basic: true });
      }
    } catch {
      setSelectedProfile({ player: { gamerTag: tag }, _basic: true });
    } finally {
      setProfileLoading(false);
    }
  }, [accessToken]);

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString();
  }

  function getNotesForTag(tag) {
    if (!tag) return [];
    const q = tag.toLowerCase();
    return (allNotes || []).filter(
      (n) => n.playerTag && n.playerTag.toLowerCase() === q
    );
  }

  // Profile detail view
  if (selectedProfile) {
    const profileImg = getProfileImage(selectedProfile);
    const location = getLocationString(selectedProfile);
    const tag = selectedProfile.player?.gamerTag || selectedProfile.name || selectedProfile.slug;
    const prefix = selectedProfile.player?.prefix;
    const rankings = selectedProfile.player?.rankings || [];
    const tournaments = selectedProfile.tournaments?.nodes || [];
    const playerNotes = getNotesForTag(tag);

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable style={styles.backBtn} onPress={() => setSelectedProfile(null)}>
          <Text style={styles.backBtnLabel}>← All Players</Text>
        </Pressable>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            {profileImg ? (
              <Image source={{ uri: profileImg }} style={styles.profileAvatar} />
            ) : (
              <View style={styles.profileAvatarPlaceholder}>
                <Text style={styles.profileAvatarText}>{tag[0]?.toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <View style={styles.profileNameRow}>
                {prefix ? <Text style={styles.profilePrefix}>{prefix} |</Text> : null}
                <Text style={styles.profileTag}>{tag}</Text>
              </View>
              {location ? <Text style={styles.profileLocation}>{location}</Text> : null}
              {selectedProfile.bio ? <Text style={styles.profileBio} numberOfLines={2}>{selectedProfile.bio}</Text> : null}
            </View>
          </View>

          {/* Rankings */}
          {rankings.length > 0 && (
            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>Rankings</Text>
              {rankings.map((r) => (
                <View key={r.id} style={styles.rankRow}>
                  <Text style={styles.rankPosition}>#{r.rank}</Text>
                  <Text style={styles.rankTitle}>{r.title}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Recent Tournaments */}
          {tournaments.length > 0 && (
            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>Recent Tournaments</Text>
              {tournaments.map((t) => (
                <View key={t.id} style={styles.tournamentRow}>
                  <Text style={styles.tournamentName}>{t.name}</Text>
                  <Text style={styles.tournamentDate}>
                    {t.startAt ? new Date(t.startAt * 1000).toLocaleDateString() : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Notes for this player */}
        <View style={styles.profileSection}>
          <Text style={styles.profileSectionTitle}>Notes ({playerNotes.length})</Text>
          {playerNotes.length > 0 ? (
            playerNotes.sort((a, b) => b.updatedAt - a.updatedAt).map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                onEdit={onEditNote}
                onDelete={onDeleteNote}
                onSave={onSaveInlineEdit}
                onViewVod={onViewVod}
                forceDark
                compact
              />
            ))
          ) : (
            <Text style={styles.noNotesText}>No notes for this player yet.</Text>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Search bar */}
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search players..."
        placeholderTextColor="#8A93A7"
      />

      {/* Recent opponents from Start.gg */}
      {recentOpponents.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Opponents</Text>
            <Text style={styles.sectionMeta}>from Start.gg</Text>
          </View>
          {opponentsLoading && recentOpponents.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#FF6B3D" />
              <Text style={styles.loadingText}>Loading opponents...</Text>
            </View>
          ) : (
            <DragScrollRow onLoadMore={hasMoreRef.current ? loadNextPage : null} isLoadingMore={opponentsLoadingMore}>
              {filteredOpponents.map((opp) => {
                const topChar = opp.characters[0] ? resolveFighterName(opp.characters[0]) : null;
                const noteCount = (allNotes || []).filter(
                  (n) => n.playerTag && n.playerTag.toLowerCase() === opp.gamerTag.toLowerCase()
                ).length;

                return (
                  <Pressable
                    key={opp.gamerTag}
                    style={styles.opponentTile}
                    onPress={() => handleViewProfile(opp.gamerTag)}
                  >
                    {topChar ? (
                      <Image source={getFighterIcon(topChar)} style={styles.opponentIcon} resizeMode="contain" />
                    ) : (
                      <View style={styles.opponentIconPlaceholder}>
                        <Text style={styles.opponentIconText}>{opp.gamerTag[0]?.toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={styles.opponentTag} numberOfLines={1}>{opp.gamerTag}</Text>
                    {opp.characters.length > 0 && (
                      <Text style={styles.opponentChars} numberOfLines={1}>{opp.characters.map(resolveFighterName).slice(0, 2).join(", ")}</Text>
                    )}
                    {noteCount > 0 ? (
                      <Text style={styles.opponentNoteCount}>{noteCount} note{noteCount !== 1 ? "s" : ""}</Text>
                    ) : onTrackPlayer ? (
                      <Pressable
                        style={styles.trackBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          onTrackPlayer({ gamerTag: opp.gamerTag, playerId: opp.playerId });
                        }}
                      >
                        <Text style={styles.trackBtnLabel}>+ Track</Text>
                      </Pressable>
                    ) : null}
                  </Pressable>
                );
              })}
            </DragScrollRow>
          )}
          {filteredOpponents.length === 0 && search.trim() && (
            <Text style={styles.searchError}>No opponents match "{search}"</Text>
          )}
        </>
      )}

      {profileLoading && (
        <View style={{ alignItems: "center", padding: 16 }}>
          <ActivityIndicator size="small" color="#FF6B3D" />
          <Text style={{ color: "#96A3BD", fontSize: 12, marginTop: 6 }}>Loading profile...</Text>
        </View>
      )}

      {/* Local players from notes */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Players</Text>
        <Text style={styles.sectionMeta}>{players.length} tracked</Text>
      </View>

      {filteredLocal.length === 0 ? (
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
        filteredLocal.map((player) => {
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
                <View style={styles.playerActions}>
                  {accessToken && (
                    <Pressable
                      style={styles.lookupBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleViewProfile(player.tag);
                      }}
                    >
                      <Text style={styles.lookupBtnLabel}>Profile</Text>
                    </Pressable>
                  )}
                  <Text style={styles.expandIcon}>{isExpanded ? "▲" : "▼"}</Text>
                </View>
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
                        onViewVod={onViewVod}
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
  searchRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  search: {
    flex: 1,
    backgroundColor: "#1B2333",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
    color: "#ECF2FF",
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: "#FF6B3D",
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  searchBtnLabel: { color: "#fff", fontWeight: "700", fontSize: 13 },
  searchError: { color: "#96A3BD", fontSize: 12, marginBottom: 12, fontStyle: "italic" },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#1B2333",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
  },
  loadingText: { color: "#96A3BD", fontSize: 13 },

  // Opponents horizontal scroll
  opponentsScroll: { marginBottom: 16 },
  opponentsScrollContent: { gap: 10, paddingRight: 16 },
  opponentTile: {
    width: 100,
    backgroundColor: "#1B2333",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A3449",
  },
  opponentIcon: { width: 44, height: 44, borderRadius: 22, marginBottom: 6, backgroundColor: "#141C2B" },
  opponentIconPlaceholder: {
    width: 44, height: 44, borderRadius: 22, marginBottom: 6,
    backgroundColor: "#2A4D9B", justifyContent: "center", alignItems: "center",
  },
  opponentIconText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  opponentTag: { color: "#F4F7FF", fontSize: 12, fontWeight: "700", textAlign: "center" },
  opponentChars: { color: "#96A3BD", fontSize: 10, textAlign: "center", marginTop: 2 },
  opponentNoteCount: { color: "#FF6B3D", fontSize: 10, fontWeight: "700", marginTop: 3 },
  trackBtn: {
    backgroundColor: "#2A4D9B",
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  trackBtnLabel: { color: "#fff", fontSize: 9, fontWeight: "700" },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2A3449",
  },
  sectionTitle: { color: "#F4F7FF", fontSize: 18, fontWeight: "800" },
  sectionMeta: { color: "#96A3BD", fontSize: 12, fontWeight: "700" },

  // Profile view
  backBtn: { marginBottom: 16 },
  backBtnLabel: { color: "#6B9CFF", fontSize: 14, fontWeight: "700" },
  profileCard: {
    backgroundColor: "#1B2333",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A3449",
  },
  profileHeader: { flexDirection: "row", gap: 14, marginBottom: 16 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32 },
  profileAvatarPlaceholder: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#2A4D9B", justifyContent: "center", alignItems: "center",
  },
  profileAvatarText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  profileInfo: { flex: 1, justifyContent: "center" },
  profileNameRow: { flexDirection: "row", alignItems: "baseline", gap: 4, flexWrap: "wrap" },
  profilePrefix: { color: "#96A3BD", fontSize: 14, fontWeight: "600" },
  profileTag: { color: "#F4F7FF", fontSize: 22, fontWeight: "800" },
  profileLocation: { color: "#96A3BD", fontSize: 13, marginTop: 4 },
  profileBio: { color: "#96A3BD", fontSize: 12, marginTop: 4, fontStyle: "italic", lineHeight: 18 },
  profileSection: { marginTop: 12 },
  profileSectionTitle: { color: "#F4F7FF", fontSize: 16, fontWeight: "800", marginBottom: 8 },
  rankRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#141C2B", borderRadius: 8, padding: 10, marginBottom: 6,
  },
  rankPosition: { color: "#F59E0B", fontSize: 18, fontWeight: "800", minWidth: 40 },
  rankTitle: { color: "#ECF2FF", fontSize: 13, fontWeight: "600", flex: 1 },
  tournamentRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#141C2B", borderRadius: 8, padding: 10, marginBottom: 6,
  },
  tournamentName: { color: "#ECF2FF", fontSize: 13, fontWeight: "600", flex: 1 },
  tournamentDate: { color: "#637083", fontSize: 11 },
  noNotesText: { color: "#637083", fontSize: 13, fontStyle: "italic", marginTop: 8 },

  // Local player cards
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
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#141C2B",
  },
  playerIconPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#2A4D9B", justifyContent: "center", alignItems: "center",
  },
  playerIconText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  playerInfo: { flex: 1 },
  playerTag: { color: "#F4F7FF", fontSize: 17, fontWeight: "800" },
  playerMeta: {
    flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4,
  },
  playerMetaText: { color: "#96A3BD", fontSize: 12 },
  playerMetaDate: { color: "#637083", fontSize: 12 },
  playerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  lookupBtn: {
    backgroundColor: "#2A4D9B",
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  lookupBtnLabel: { color: "#fff", fontSize: 11, fontWeight: "700" },
  expandIcon: { color: "#637083", fontSize: 12, fontWeight: "800" },
  playerNotes: {
    padding: 12, paddingTop: 0,
    borderTopWidth: 1, borderTopColor: "#2A3449",
  },
  totalWrap: { alignItems: "center", paddingVertical: 16 },
  totalText: { color: "#637083", fontSize: 12, fontWeight: "600" },
});
