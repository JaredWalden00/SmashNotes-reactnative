import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, Pressable, TextInput, ScrollView, Image, ActivityIndicator, StyleSheet } from "react-native";
import { getUserRegisteredTournaments } from "../utils/startggData";
import { startggGraphQL } from "../lib/startggApi";
import { getFighterIcon, resolveFighterName } from "../data/smashFighters";
import LiveTextEditor from "./LiveTextEditor";
import NoteItem from "./NoteItem";

const POLL_INTERVAL = 30000; // 30 seconds

function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleTimeString(undefined, {
    hour: "numeric", minute: "2-digit",
  });
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export default function TournamentTab({ allNotes, onCreateNoteSilent, onEditNote, onDeleteNote, onSaveInlineEdit, onViewVod, accessToken, playerGamerTag, pendingTournament, onClearPendingTournament }) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detail view state
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [sets, setSets] = useState([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [inlineNoteSetId, setInlineNoteSetId] = useState(null);
  const [inlineNoteTitle, setInlineNoteTitle] = useState("");
  const [inlineNoteContent, setInlineNoteContent] = useState("");
  const [viewingPlayer, setViewingPlayer] = useState(null); // gamerTag of player being viewed
  const pollRef = useRef(null);

  // Auto-open a pending tournament from My Stuff card
  useEffect(() => {
    if (pendingTournament) {
      handleSelectTournament(pendingTournament);
      if (onClearPendingTournament) onClearPendingTournament();
    }
  }, [pendingTournament]);

  // Load tournaments
  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    getUserRegisteredTournaments({ perPage: 50 })
      .then((data) => {
        if (mounted) {
          // Sort by startAt, upcoming first
          const sorted = [...data].sort((a, b) => (b.startAt || 0) - (a.startAt || 0));
          setTournaments(sorted);
        }
      })
      .catch((err) => { if (mounted) setError(err.message || "Failed to load"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [accessToken]);

  // Fetch entrants for an event using authenticated query
  async function fetchEventEntrants(eventId) {
    if (!accessToken) return [];
    try {
      const query = `
        query EventEntrants($eventId: ID!) {
          event(id: $eventId) {
            entrants(query: { perPage: 100 }) {
              nodes {
                id
                name
                initialSeedNum
                participants {
                  id
                  gamerTag
                  prefix
                }
              }
            }
          }
        }
      `;
      const data = await startggGraphQL(query, { eventId: String(eventId) }, accessToken);
      return data?.event?.entrants?.nodes || [];
    } catch (err) {
      console.warn("Failed to fetch entrants:", err.message);
      return [];
    }
  }

  // Load events when tournament selected — use events already on the tournament object
  const handleSelectTournament = useCallback(async (tournament) => {
    setSelectedTournament(tournament);
    setSets([]);
    setEventsLoading(true);

    // Use smashEvents from the tournament (already fetched with IDs)
    const evts = (tournament.smashEvents || tournament.events || []).map((e) => ({
      ...e,
      entrants: [],
    }));
    setEvents(evts);

    // Auto-select the best event — prefer "Singles" over others
    if (evts.length > 0) {
      const singlesEvent = evts.find((e) =>
        /singles/i.test(e.name) && !/doubles|redemption|side/i.test(e.name)
      ) || evts.find((e) => /singles/i.test(e.name)) || evts[0];
      setSelectedEventId(singlesEvent.id);
      try {
        const entrants = await fetchEventEntrants(singlesEvent.id);
        setEvents((prev) => prev.map((e) => e.id === singlesEvent.id ? { ...e, entrants } : e));
      } catch {}
    }
    setEventsLoading(false);
  }, [accessToken]);

  // Fetch sets for selected event using authenticated query
  const fetchSets = useCallback(async () => {
    if (!selectedEventId || !accessToken) return;
    setSetsLoading(true);
    try {
      // Fetch multiple pages to get all sets
      let allNodes = [];
      for (let page = 1; page <= 5; page++) {
        const query = `
          query EventSets($eventId: ID!, $page: Int!) {
            event(id: $eventId) {
              name
              sets(perPage: 50, page: $page) {
                pageInfo {
                  totalPages
                }
                nodes {
                  id
                  displayScore
                  fullRoundText
                  round
                  winnerId
                  state
                  completedAt
                  slots {
                    entrant {
                      id
                      name
                      participants {
                        id
                        gamerTag
                        prefix
                      }
                    }
                  }
                }
              }
            }
          }
        `;
        const data = await startggGraphQL(query, { eventId: String(selectedEventId), page }, accessToken);
        const nodes = data?.event?.sets?.nodes || [];
        const totalPages = data?.event?.sets?.pageInfo?.totalPages || 1;

        allNodes = allNodes.concat(nodes);
        if (page >= totalPages || nodes.length === 0) break;
      }

      // Normalize: map slots to entrant1/entrant2 for compatibility
      const normalized = allNodes.map((set) => ({
        ...set,
        entrant1: set.slots?.[0]?.entrant || null,
        entrant2: set.slots?.[1]?.entrant || null,
      }));


      setSets(normalized);
      setLastRefresh(new Date());

      // Also fetch entrants if we don't have them yet
      const currentEvent = events.find((e) => e.id === selectedEventId);
      if (currentEvent && (!currentEvent.entrants || currentEvent.entrants.length === 0)) {
        const entrants = await fetchEventEntrants(selectedEventId);
        setEvents((prev) => prev.map((e) => e.id === selectedEventId ? { ...e, entrants } : e));
      }
    } catch (err) {
      console.error("Failed to fetch sets:", err);
    } finally {
      setSetsLoading(false);
    }
  }, [selectedEventId, accessToken, events]);

  // Initial fetch + polling
  useEffect(() => {
    if (selectedEventId) {
      fetchSets();
      pollRef.current = setInterval(fetchSets, POLL_INTERVAL);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedEventId, fetchSets]);

  // Find user's next match
  const myNextMatch = useMemo(() => {
    if (!playerGamerTag || !sets.length) return null;
    const tagLower = playerGamerTag.toLowerCase();
    // Find incomplete sets involving the user
    const mySets = sets.filter((set) => {
      if (set.state === 3) return false; // 3 = completed
      const inE1 = set.entrant1?.participants?.some((p) => p.gamerTag?.toLowerCase() === tagLower);
      const inE2 = set.entrant2?.participants?.some((p) => p.gamerTag?.toLowerCase() === tagLower);
      return inE1 || inE2;
    });
    return mySets[0] || null;
  }, [sets, playerGamerTag]);

  // Check if an entrant is the current user
  function isUserEntrant(entrant) {
    if (!entrant || !playerGamerTag) return false;
    const tagLower = playerGamerTag.toLowerCase();
    if (entrant.participants?.some((p) => p.gamerTag?.toLowerCase() === tagLower)) return true;
    if (entrant.name?.toLowerCase().includes(tagLower)) return true;
    return false;
  }

  // Get opponent from a set
  function getOpponent(set) {
    if (!playerGamerTag) return set.entrant1?.participants?.[0] || null;
    if (isUserEntrant(set.entrant1)) return set.entrant2?.participants?.[0] || null;
    return set.entrant1?.participants?.[0] || null;
  }

  // Check if user won the set
  function didUserWin(set) {
    if (!playerGamerTag || !set.winnerId) return null;
    if (isUserEntrant(set.entrant1)) return set.winnerId === set.entrant1?.id;
    if (isUserEntrant(set.entrant2)) return set.winnerId === set.entrant2?.id;
    return null;
  }

  // Count notes for a player tag
  function noteCountFor(tag) {
    if (!tag) return 0;
    const q = tag.toLowerCase();
    return (allNotes || []).filter((n) => n.playerTag?.toLowerCase() === q).length;
  }

  function openInlineNote(setId, oppTag, roundText, score) {
    if (inlineNoteSetId === setId) {
      setInlineNoteSetId(null);
      return;
    }
    setInlineNoteSetId(setId);
    setInlineNoteTitle(`vs ${oppTag} — ${roundText || "Set"}`);
    setInlineNoteContent("");
  }

  function saveInlineNote(setData) {
    if (!inlineNoteContent.trim() && !inlineNoteTitle.trim()) return;
    if (onCreateNoteSilent) {
      onCreateNoteSilent({
        title: inlineNoteTitle.trim() || "Tournament Note",
        content: inlineNoteContent,
        playerTag: setData.playerTag,
        setId: setData.setId,
        setTournament: setData.setTournament,
        setEvent: setData.setEvent,
        setScore: setData.setScore,
      });
    }
    setInlineNoteSetId(null);
    setInlineNoteTitle("");
    setInlineNoteContent("");
  }

  // Get all entrants from events
  const allEntrants = useMemo(() => {
    const map = {};
    const selectedEvt = events.find((e) => e.id === selectedEventId);
    for (const entrant of (selectedEvt?.entrants || [])) {
      for (const p of (entrant.participants || [])) {
        if (p.gamerTag) {
          const key = p.gamerTag.toLowerCase();
          if (!map[key]) map[key] = { gamerTag: p.gamerTag, prefix: p.prefix, seed: entrant.initialSeedNum || entrant.initialSeed };
        }
      }
    }
    return Object.values(map).sort((a, b) => (a.seed || 999) - (b.seed || 999));
  }, [events, selectedEventId]);

  // Player detail view — shows all notes about a player + notes about their characters
  if (viewingPlayer) {
    const vpLower = viewingPlayer.toLowerCase();
    const playerNotes = (allNotes || []).filter(
      (n) => n.playerTag?.toLowerCase() === vpLower
    ).sort((a, b) => b.updatedAt - a.updatedAt);

    // Also find notes about characters this player plays (from opponent field matching their tag)
    const characterNotes = (allNotes || []).filter(
      (n) => !n.playerTag && n.opponent?.toLowerCase() === vpLower
    ).sort((a, b) => b.updatedAt - a.updatedAt);

    // Get unique characters from player notes
    const playerChars = [...new Set(playerNotes.map((n) => n.character).filter((c) => c && c !== "General"))];

    // Character matchup notes — notes about characters the player is known to play
    const charMatchupNotes = (allNotes || []).filter((n) => {
      if (n.playerTag?.toLowerCase() === vpLower) return false; // Already in playerNotes
      if (!n.opponent || !n.category || n.category !== "matchup") return false;
      // Check if the opponent character matches any character this player plays
      return playerChars.some((pc) => n.opponent?.toLowerCase() === pc.toLowerCase());
    }).sort((a, b) => b.updatedAt - a.updatedAt);

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable style={styles.backBtn} onPress={() => setViewingPlayer(null)}>
          <Text style={styles.backBtnLabel}>← Back to Tournament</Text>
        </Pressable>

        <View style={styles.playerDetailHeader}>
          <View style={styles.playerDetailAvatar}>
            <Text style={styles.playerDetailAvatarText}>{viewingPlayer[0]?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.playerDetailName}>{viewingPlayer}</Text>
            <Text style={styles.playerDetailMeta}>
              {playerNotes.length} note{playerNotes.length !== 1 ? "s" : ""} about this player
            </Text>
            {playerChars.length > 0 && (
              <Text style={styles.playerDetailChars}>Plays: {playerChars.join(", ")}</Text>
            )}
          </View>
        </View>

        {/* Player-specific notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Player Notes ({playerNotes.length})</Text>
          {playerNotes.length > 0 ? (
            playerNotes.map((note) => (
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
            <Text style={styles.noData}>No notes yet — create one from a match above.</Text>
          )}
        </View>

        {/* Character matchup notes */}
        {charMatchupNotes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Character Matchup Notes ({charMatchupNotes.length})</Text>
            <Text style={styles.sectionSubtitle}>Notes about characters {viewingPlayer} plays</Text>
            {charMatchupNotes.map((note) => (
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

        {/* Opponent-tagged notes (older style where opponent field has the player name) */}
        {characterNotes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Related Notes ({characterNotes.length})</Text>
            {characterNotes.map((note) => (
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

        {/* Quick add note */}
        <View style={styles.section}>
          <Pressable
            style={styles.noteBtn}
            onPress={() => onCreateNoteSilent && onCreateNoteSilent({
              title: `${viewingPlayer} — Notes`,
              playerTag: viewingPlayer,
            })}
          >
            <Text style={styles.noteBtnLabel}>+ Add Note for {viewingPlayer}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // No access token
  if (!accessToken) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyIcon}>🏆</Text>
        <Text style={styles.emptyTitle}>Connect Start.gg</Text>
        <Text style={styles.emptyBody}>Connect your Start.gg account in Settings to see your upcoming tournaments.</Text>
      </View>
    );
  }

  // Loading
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#FF6B3D" />
        <Text style={styles.loadingText}>Loading tournaments...</Text>
      </View>
    );
  }

  // Tournament detail view
  if (selectedTournament) {
    const selectedEvent = events.find((e) => e.id === selectedEventId);
    const tagLower = playerGamerTag?.toLowerCase() || "";

    // Filter to only the user's sets — match by gamerTag or entrant name
    const mySets = sets.filter((set) => {
      const matchEntrant = (entrant) => {
        if (!entrant) return false;
        if (entrant.participants?.some((p) => p.gamerTag?.toLowerCase() === tagLower)) return true;
        if (entrant.name?.toLowerCase().includes(tagLower)) return true;
        return false;
      };
      return matchEntrant(set.entrant1) || matchEntrant(set.entrant2);
    });

    // Sort by most recent first — pending at top, then completed newest first
    const mySortedSets = [...mySets].sort((a, b) => {
      // Pending sets first
      if (!a.completedAt && b.completedAt) return -1;
      if (a.completedAt && !b.completedAt) return 1;
      // Both completed: newest first
      if (a.completedAt && b.completedAt) return b.completedAt - a.completedAt;
      return Math.abs(b.round || 0) - Math.abs(a.round || 0);
    });

    const myCompletedSets = mySortedSets.filter((s) => s.state === 3);
    const myPendingSets = mySortedSets.filter((s) => s.state !== 3);

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable style={styles.backBtn} onPress={() => { setSelectedTournament(null); if (pollRef.current) clearInterval(pollRef.current); }}>
          <Text style={styles.backBtnLabel}>← All Tournaments</Text>
        </Pressable>

        {/* Tournament header */}
        <View style={styles.tournamentHeader}>
          <Text style={styles.tournamentDetailName}>{selectedTournament.name}</Text>
          <Text style={styles.tournamentDetailMeta}>
            {formatDate(selectedTournament.startAt)}
            {selectedTournament.city ? ` — ${selectedTournament.city}${selectedTournament.addrState ? `, ${selectedTournament.addrState}` : ""}` : ""}
          </Text>
        </View>

        {/* Event selector */}
        {events.length > 1 && (
          <View style={styles.eventTabs}>
            {events.map((evt) => (
              <Pressable
                key={evt.id}
                style={[styles.eventTab, selectedEventId === evt.id && styles.eventTabActive]}
                onPress={() => {
                  setSelectedEventId(evt.id);
                  setSets([]);
                  // Fetch entrants if not loaded yet
                  if (!evt.entrants || evt.entrants.length === 0) {
                    fetchEventEntrants(evt.id).then((entrants) => {
                      setEvents((prev) => prev.map((e) => e.id === evt.id ? { ...e, entrants } : e));
                    }).catch(() => {});
                  }
                }}
              >
                <Text style={[styles.eventTabLabel, selectedEventId === evt.id && styles.eventTabLabelActive]}>
                  {evt.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {eventsLoading ? (
          <ActivityIndicator size="small" color="#FF6B3D" style={{ marginVertical: 20 }} />
        ) : null}

        {/* Live indicator */}
        {lastRefresh && (
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live — updated {timeAgo(lastRefresh)}</Text>
            {setsLoading && <ActivityIndicator size="small" color="#FF6B3D" style={{ marginLeft: 8 }} />}
          </View>
        )}

        {/* Your Next Match */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Next Match</Text>
          {myNextMatch ? (() => {
            const opp = getOpponent(myNextMatch);
            const oppTag = opp?.gamerTag || "TBD";
            const notes = noteCountFor(oppTag);
            return (
              <View style={styles.nextMatchCard}>
                <View style={styles.nextMatchHeader}>
                  <Text style={styles.nextMatchRound}>{myNextMatch.fullRoundText || "Upcoming"}</Text>
                </View>
                <View style={styles.nextMatchBody}>
                  <View style={styles.nextMatchPlayer}>
                    <Text style={styles.nextMatchYou}>{playerGamerTag}</Text>
                  </View>
                  <Text style={styles.nextMatchVs}>VS</Text>
                  <Pressable style={styles.nextMatchPlayer} onPress={() => oppTag !== "TBD" && setViewingPlayer(oppTag)}>
                    <Text style={styles.nextMatchOpp}>{opp?.prefix ? `${opp.prefix} | ` : ""}{oppTag}</Text>
                    <Text style={styles.viewPlayerLink}>View notes →</Text>
                  </Pressable>
                </View>
                <View style={styles.nextMatchActions}>
                  {notes > 0 && <Text style={styles.nextMatchNotes}>{notes} note{notes !== 1 ? "s" : ""} on file</Text>}
                  <Pressable
                    style={styles.noteBtn}
                    onPress={() => openInlineNote(myNextMatch.id, oppTag, myNextMatch.fullRoundText, "")}
                  >
                    <Text style={styles.noteBtnLabel}>{inlineNoteSetId === myNextMatch.id ? "Close" : "+ Note"}</Text>
                  </Pressable>
                </View>
                {inlineNoteSetId === myNextMatch.id && (
                  <View style={styles.inlineEditor}>
                    <TextInput
                      style={styles.inlineTitle}
                      value={inlineNoteTitle}
                      onChangeText={setInlineNoteTitle}
                      placeholder="Note title..."
                      placeholderTextColor="#637083"
                    />
                    <LiveTextEditor
                      value={inlineNoteContent}
                      onChange={setInlineNoteContent}
                      placeholder="Write notes about this match..."
                      minHeight={120}
                    />
                    <View style={styles.inlineActions}>
                      <Pressable style={styles.inlineCancelBtn} onPress={() => setInlineNoteSetId(null)}>
                        <Text style={styles.inlineCancelLabel}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.inlineSaveBtn, (!inlineNoteContent.trim() && !inlineNoteTitle.trim()) && { opacity: 0.4 }]}
                        onPress={() => saveInlineNote({
                          playerTag: oppTag,
                          setId: myNextMatch.id,
                          setTournament: selectedTournament.name,
                          setEvent: selectedEvent?.name || "",
                          setScore: "",
                        })}
                      >
                        <Text style={styles.inlineSaveLabel}>Save Note</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })() : (
            <Text style={styles.noData}>No upcoming match found — you may be waiting for bracket to update.</Text>
          )}
        </View>

        {/* Attendees */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendees ({allEntrants.length})</Text>
          <TextInput
            style={styles.attendeeSearch}
            value={attendeeSearch}
            onChangeText={setAttendeeSearch}
            placeholder="Search attendees..."
            placeholderTextColor="#637083"
          />
          <View style={styles.attendeeGrid}>
            {(() => {
              const filtered = attendeeSearch.trim()
                ? allEntrants.filter((e) => e.gamerTag.toLowerCase().includes(attendeeSearch.trim().toLowerCase()))
                : allEntrants;
              return filtered.slice(0, 100).map((ent) => {
                const notes = noteCountFor(ent.gamerTag);
                const isYou = playerGamerTag && ent.gamerTag.toLowerCase() === playerGamerTag.toLowerCase();
                return (
                  <Pressable key={ent.gamerTag} style={[styles.attendeeChip, isYou && styles.attendeeChipYou]} onPress={() => !isYou && setViewingPlayer(ent.gamerTag)}>
                    {ent.seed && <Text style={styles.attendeeSeed}>#{ent.seed}</Text>}
                    <Text style={[styles.attendeeTag, isYou && styles.attendeeTagYou]} numberOfLines={1}>
                      {ent.prefix ? `${ent.prefix} | ` : ""}{ent.gamerTag}
                    </Text>
                    {notes > 0 && <Text style={styles.attendeeNotes}>{notes}</Text>}
                  </Pressable>
                );
              });
            })()}
          </View>
        </View>

        {/* Your Matches — chronological order */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Matches ({mySortedSets.length})</Text>
          {mySortedSets.length === 0 ? (
            <Text style={styles.noData}>No matches found yet</Text>
          ) : (
            mySortedSets.map((set, index) => {
              const won = didUserWin(set);
              const opp = getOpponent(set);
              const oppTag = opp?.gamerTag || "TBD";
              const isCompleted = set.state === 3;
              const isPending = !isCompleted;
              const notes = noteCountFor(oppTag);

              return (
                <View key={set.id} style={{ marginBottom: 6 }}>
                <View style={[styles.matchRow, isPending && styles.matchRowPending, { marginBottom: 0 }]}>
                  <Text style={styles.matchNumber}>#{index + 1}</Text>
                  {isCompleted && won !== null && (
                    <View style={[styles.resultIndicator, won ? styles.resultWin : styles.resultLoss]} />
                  )}
                  {isPending && <View style={[styles.resultIndicator, styles.resultPending]} />}
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultRound}>{set.fullRoundText || ""}</Text>
                    {isCompleted ? (
                      <Text style={styles.resultScore}>{set.displayScore || `vs ${oppTag}`}</Text>
                    ) : (
                      <Text style={styles.resultScore}>vs {oppTag}</Text>
                    )}
                    {oppTag && oppTag !== "TBD" && (
                      <Pressable onPress={() => setViewingPlayer(oppTag)}>
                        <Text style={styles.viewPlayerLink}>View {oppTag}'s notes →</Text>
                      </Pressable>
                    )}
                    {notes > 0 && <Text style={styles.matchNoteIndicator}>{notes} note{notes !== 1 ? "s" : ""}</Text>}
                  </View>
                  {isCompleted && won !== null && (
                    <Text style={[styles.resultLabel, won ? styles.resultWinLabel : styles.resultLossLabel]}>
                      {won ? "W" : "L"}
                    </Text>
                  )}
                  {isPending && <Text style={[styles.resultLabel, styles.resultPendingLabel]}>—</Text>}
                  <Pressable
                    style={styles.setNoteBtn}
                    onPress={() => openInlineNote(set.id, oppTag, set.fullRoundText, set.displayScore)}
                  >
                    <Text style={styles.setNoteBtnLabel}>{inlineNoteSetId === set.id ? "Close" : "Note"}</Text>
                  </Pressable>
                </View>
                {inlineNoteSetId === set.id && (
                  <View style={styles.inlineEditor}>
                    <TextInput
                      style={styles.inlineTitle}
                      value={inlineNoteTitle}
                      onChangeText={setInlineNoteTitle}
                      placeholder="Note title..."
                      placeholderTextColor="#637083"
                    />
                    <LiveTextEditor
                      value={inlineNoteContent}
                      onChange={setInlineNoteContent}
                      placeholder="Write notes about this set..."
                      minHeight={120}
                    />
                    <View style={styles.inlineActions}>
                      <Pressable style={styles.inlineCancelBtn} onPress={() => setInlineNoteSetId(null)}>
                        <Text style={styles.inlineCancelLabel}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.inlineSaveBtn, (!inlineNoteContent.trim() && !inlineNoteTitle.trim()) && { opacity: 0.4 }]}
                        onPress={() => saveInlineNote({
                          playerTag: oppTag,
                          setId: set.id,
                          setTournament: selectedTournament.name,
                          setEvent: selectedEvent?.name || "",
                          setScore: set.displayScore || "",
                        })}
                      >
                        <Text style={styles.inlineSaveLabel}>Save Note</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    );
  }

  // Tournament list
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error && <Text style={styles.errorText}>{error}</Text>}

      {tournaments.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={styles.emptyTitle}>No tournaments found</Text>
          <Text style={styles.emptyBody}>Register for tournaments on start.gg to see them here.</Text>
        </View>
      ) : (
        tournaments.map((t) => {
          const isUpcoming = t.startAt && t.startAt * 1000 > Date.now();
          const isLive = t.startAt && t.endAt && t.startAt * 1000 <= Date.now() && t.endAt * 1000 >= Date.now();
          return (
            <Pressable key={t.id} style={styles.tournamentCard} onPress={() => handleSelectTournament(t)}>
              <View style={styles.tournamentCardHeader}>
                <View style={styles.tournamentCardInfo}>
                  <Text style={styles.tournamentName}>{t.name}</Text>
                  <Text style={styles.tournamentMeta}>
                    {formatDate(t.startAt)}
                    {t.city ? ` — ${t.city}${t.addrState ? `, ${t.addrState}` : ""}` : ""}
                    {t.isOnline ? " — Online" : ""}
                  </Text>
                  {t.smashEvents?.length > 0 && (
                    <Text style={styles.tournamentEvents}>
                      {t.smashEvents.map((e) => e.name).join(", ")}
                    </Text>
                  )}
                </View>
                <View style={styles.tournamentCardRight}>
                  {isLive && (
                    <View style={styles.liveBadge}>
                      <View style={styles.liveBadgeDot} />
                      <Text style={styles.liveBadgeLabel}>LIVE</Text>
                    </View>
                  )}
                  {isUpcoming && !isLive && (
                    <View style={styles.upcomingBadge}>
                      <Text style={styles.upcomingBadgeLabel}>Upcoming</Text>
                    </View>
                  )}
                  <Text style={styles.tournamentArrow}>→</Text>
                </View>
              </View>
            </Pressable>
          );
        })
      )}
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
  errorText: { color: "#F87171", fontSize: 12, marginBottom: 12 },

  // Tournament list
  tournamentCard: {
    backgroundColor: "#1B2333",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
  },
  tournamentCardHeader: { flexDirection: "row", alignItems: "center" },
  tournamentCardInfo: { flex: 1 },
  tournamentName: { color: "#F4F7FF", fontSize: 17, fontWeight: "800" },
  tournamentMeta: { color: "#96A3BD", fontSize: 12, marginTop: 4 },
  tournamentEvents: { color: "#6B9CFF", fontSize: 11, fontWeight: "600", marginTop: 4 },
  tournamentCardRight: { alignItems: "flex-end", gap: 6 },
  tournamentArrow: { color: "#637083", fontSize: 18 },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#1B4332", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  liveBadgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399" },
  liveBadgeLabel: { color: "#34D399", fontSize: 11, fontWeight: "800" },
  upcomingBadge: {
    backgroundColor: "#1E3254", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  upcomingBadgeLabel: { color: "#6B9CFF", fontSize: 11, fontWeight: "700" },

  // Detail view
  backBtn: { marginBottom: 16 },
  backBtnLabel: { color: "#6B9CFF", fontSize: 14, fontWeight: "700" },
  tournamentHeader: { marginBottom: 16 },
  tournamentDetailName: { color: "#F4F7FF", fontSize: 24, fontWeight: "800" },
  tournamentDetailMeta: { color: "#96A3BD", fontSize: 13, marginTop: 4 },
  eventTabs: { flexDirection: "row", gap: 6, marginBottom: 16, flexWrap: "wrap" },
  eventTab: {
    backgroundColor: "#141C2B", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "#2A3449",
  },
  eventTabActive: { backgroundColor: "#FF6B3D", borderColor: "#FF6B3D" },
  eventTabLabel: { color: "#96A3BD", fontSize: 13, fontWeight: "700" },
  eventTabLabelActive: { color: "#fff" },

  // Live indicator
  liveRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16,
    backgroundColor: "#1B4332", borderRadius: 8, padding: 10,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399" },
  liveText: { color: "#34D399", fontSize: 12, fontWeight: "700" },

  // Sections
  section: {
    backgroundColor: "#1B2333", borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "#2A3449",
  },
  sectionTitle: { color: "#F4F7FF", fontSize: 18, fontWeight: "800", marginBottom: 12 },
  noData: { color: "#637083", fontSize: 13, fontStyle: "italic" },

  // Next match
  nextMatchCard: {
    backgroundColor: "#141C2B", borderRadius: 12, padding: 16,
    borderWidth: 2, borderColor: "#FF6B3D",
  },
  nextMatchHeader: { marginBottom: 12 },
  nextMatchRound: { color: "#FF6B3D", fontSize: 14, fontWeight: "800" },
  nextMatchBody: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 12,
  },
  nextMatchPlayer: { flex: 1, alignItems: "center" },
  nextMatchYou: { color: "#34D399", fontSize: 18, fontWeight: "800" },
  nextMatchVs: { color: "#637083", fontSize: 14, fontWeight: "800" },
  nextMatchOpp: { color: "#F4F7FF", fontSize: 18, fontWeight: "800" },
  nextMatchActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nextMatchNotes: { color: "#6B9CFF", fontSize: 12, fontWeight: "700" },
  noteBtn: { backgroundColor: "#FF6B3D", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  noteBtnLabel: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Attendees
  attendeeSearch: {
    backgroundColor: "#141C2B", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: "#2A3449", color: "#ECF2FF", fontSize: 13, marginBottom: 10,
  },
  attendeeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  attendeeChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#141C2B", borderRadius: 8, paddingVertical: 5, paddingHorizontal: 8,
    borderWidth: 1, borderColor: "#2A3449",
  },
  attendeeChipYou: { borderColor: "#34D399", backgroundColor: "#1B4332" },
  attendeeSeed: { color: "#637083", fontSize: 10, fontWeight: "700" },
  attendeeTag: { color: "#ECF2FF", fontSize: 12, fontWeight: "600", maxWidth: 120 },
  attendeeTagYou: { color: "#34D399" },
  attendeeNotes: {
    backgroundColor: "#FF6B3D", borderRadius: 999, width: 18, height: 18,
    textAlign: "center", lineHeight: 18, color: "#fff", fontSize: 10, fontWeight: "800",
  },

  // Sets
  setRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#141C2B", borderRadius: 8, padding: 10, marginBottom: 6,
  },
  setRound: { color: "#637083", fontSize: 11, fontWeight: "700", width: 80 },
  setPlayers: { color: "#ECF2FF", fontSize: 13, fontWeight: "600", flex: 1 },

  // Results
  resultRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#141C2B", borderRadius: 10, padding: 12, marginBottom: 6,
  },
  resultIndicator: { width: 4, height: 28, borderRadius: 2, backgroundColor: "#3A4A66" },
  resultWin: { backgroundColor: "#34D399" },
  resultLoss: { backgroundColor: "#F87171" },
  resultInfo: { flex: 1 },
  resultRound: { color: "#637083", fontSize: 11, fontWeight: "600" },
  resultScore: { color: "#ECF2FF", fontSize: 14, fontWeight: "700", marginTop: 2 },
  resultLabel: { color: "#637083", fontSize: 16, fontWeight: "800", width: 24, textAlign: "center" },
  resultWinLabel: { color: "#34D399" },
  resultLossLabel: { color: "#F87171" },
  setNoteBtn: { backgroundColor: "#2A4D9B", borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10 },
  setNoteBtnLabel: { color: "#fff", fontSize: 11, fontWeight: "700" },
  matchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#141C2B", borderRadius: 10, padding: 12, marginBottom: 6,
  },
  matchRowPending: { borderWidth: 1, borderColor: "#2A3449", borderStyle: "dashed" },
  matchNumber: { color: "#637083", fontSize: 12, fontWeight: "800", width: 24 },
  matchNoteIndicator: { color: "#6B9CFF", fontSize: 10, fontWeight: "700", marginTop: 2 },
  resultPending: { backgroundColor: "#F59E0B" },
  resultPendingLabel: { color: "#F59E0B" },
  inlineEditor: {
    marginTop: 10,
    backgroundColor: "#0F1420",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2A3449",
  },
  inlineTitle: {
    backgroundColor: "#141C2B",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#2A3449",
    color: "#ECF2FF",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  inlineActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  inlineCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#2A3449",
  },
  inlineCancelLabel: { color: "#96A3BD", fontWeight: "700", fontSize: 13 },
  inlineSaveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#FF6B3D",
  },
  inlineSaveLabel: { color: "#fff", fontWeight: "700", fontSize: 13 },
  viewPlayerLink: { color: "#6B9CFF", fontSize: 10, fontWeight: "600", marginTop: 2 },
  playerDetailHeader: {
    flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20,
  },
  playerDetailAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#2A4D9B", justifyContent: "center", alignItems: "center",
  },
  playerDetailAvatarText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  playerDetailName: { color: "#F4F7FF", fontSize: 22, fontWeight: "800" },
  playerDetailMeta: { color: "#96A3BD", fontSize: 13, marginTop: 2 },
  playerDetailChars: { color: "#FF6B3D", fontSize: 12, fontWeight: "600", marginTop: 2 },
  sectionSubtitle: { color: "#96A3BD", fontSize: 12, marginTop: -8, marginBottom: 10 },
});
