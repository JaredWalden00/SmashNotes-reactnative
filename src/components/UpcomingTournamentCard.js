import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { getUserRegisteredTournaments } from "../utils/startggData";
import { startggGraphQL } from "../lib/startggApi";

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString(undefined, {
    hour: "numeric", minute: "2-digit",
  });
}

function timeUntil(ts) {
  if (!ts) return "";
  const diff = ts * 1000 - Date.now();
  if (diff < 0) return "Now";
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `in ${days}d ${hours % 24}h`;
  if (hours > 0) return `in ${hours}h`;
  const mins = Math.floor(diff / 60000);
  return `in ${mins}m`;
}

export default function UpcomingTournamentCard({ accessToken, playerGamerTag, allNotes, onNavigateToTournament, onNavigateToPlayer }) {
  const [tournament, setTournament] = useState(null);
  const [nextMatch, setNextMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) { setLoading(false); return; }
    let mounted = true;

    async function load() {
      try {
        const tournaments = await getUserRegisteredTournaments({ perPage: 20 });
        if (!mounted) return;

        // Find the next upcoming or currently live tournament
        const now = Date.now() / 1000;
        const sorted = tournaments
          .filter((t) => t.endAt ? t.endAt > now : t.startAt > now - 86400) // Not ended, or started within last day
          .sort((a, b) => (a.startAt || 0) - (b.startAt || 0));

        const next = sorted[0] || null;
        setTournament(next);

        // If tournament is live, try to find next match
        if (next && next.startAt <= now && next.smashEvents?.length > 0) {
          const singlesEvent = next.smashEvents.find((e) => /singles/i.test(e.name) && !/doubles|redemption/i.test(e.name))
            || next.smashEvents[0];

          if (singlesEvent) {
            try {
              const query = `
                query EventSets($eventId: ID!) {
                  event(id: $eventId) {
                    sets(perPage: 20) {
                      nodes {
                        id
                        fullRoundText
                        state
                        slots {
                          entrant {
                            id
                            name
                            participants { id gamerTag prefix }
                          }
                        }
                      }
                    }
                  }
                }
              `;
              const data = await startggGraphQL(query, { eventId: String(singlesEvent.id) }, accessToken);
              const sets = data?.event?.sets?.nodes || [];

              if (playerGamerTag && mounted) {
                const tagLower = playerGamerTag.toLowerCase();
                const myPending = sets.filter((s) => {
                  if (s.state === 3) return false;
                  return s.slots?.some((slot) =>
                    slot.entrant?.participants?.some((p) => p.gamerTag?.toLowerCase() === tagLower) ||
                    slot.entrant?.name?.toLowerCase().includes(tagLower)
                  );
                });

                if (myPending.length > 0) {
                  const set = myPending[0];
                  const oppSlot = set.slots?.find((slot) =>
                    !slot.entrant?.participants?.some((p) => p.gamerTag?.toLowerCase() === tagLower) &&
                    !slot.entrant?.name?.toLowerCase().includes(tagLower)
                  );
                  const opp = oppSlot?.entrant?.participants?.[0];
                  setNextMatch({
                    round: set.fullRoundText || "Next Match",
                    opponent: opp?.gamerTag || oppSlot?.entrant?.name || "TBD",
                    prefix: opp?.prefix || null,
                  });
                }
              }
            } catch {}
          }
        }
      } catch {}
      if (mounted) setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [accessToken, playerGamerTag]);

  // Note count for the opponent
  const oppNoteCount = useMemo(() => {
    if (!nextMatch?.opponent || nextMatch.opponent === "TBD") return 0;
    const q = nextMatch.opponent.toLowerCase();
    return (allNotes || []).filter((n) => n.playerTag?.toLowerCase() === q).length;
  }, [nextMatch, allNotes]);

  if (!accessToken || loading) return null;
  if (!tournament) return null;

  const now = Date.now() / 1000;
  const isLive = tournament.startAt && tournament.startAt <= now;
  const isUpcoming = !isLive;

  return (
    <Pressable style={styles.card} onPress={() => onNavigateToTournament && onNavigateToTournament(tournament)}>
      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          {isLive ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : (
            <View style={styles.upcomingBadge}>
              <Text style={styles.upcomingText}>{timeUntil(tournament.startAt)}</Text>
            </View>
          )}
          <Text style={styles.tournamentName} numberOfLines={1}>{tournament.name}</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
      </View>

      <Text style={styles.meta}>
        {formatDate(tournament.startAt)}
        {isUpcoming ? ` at ${formatTime(tournament.startAt)}` : ""}
        {tournament.city ? ` — ${tournament.city}` : ""}
      </Text>

      {/* Next match info */}
      {nextMatch && (
        <Pressable
          style={styles.matchRow}
          onPress={(e) => {
            e.stopPropagation?.();
            if (nextMatch.opponent !== "TBD" && onNavigateToPlayer) onNavigateToPlayer(nextMatch.opponent);
          }}
        >
          <View style={styles.matchIndicator} />
          <View style={styles.matchInfo}>
            <Text style={styles.matchRound}>{nextMatch.round}</Text>
            <Text style={styles.matchOpponent}>
              vs {nextMatch.prefix ? `${nextMatch.prefix} | ` : ""}{nextMatch.opponent}
            </Text>
          </View>
          {oppNoteCount > 0 && (
            <View style={styles.notesBadge}>
              <Text style={styles.notesBadgeText}>{oppNoteCount} note{oppNoteCount !== 1 ? "s" : ""}</Text>
            </View>
          )}
          {nextMatch.opponent !== "TBD" && (
            <Text style={styles.viewNotesLink}>Notes →</Text>
          )}
        </Pressable>
      )}

      {isLive && !nextMatch && (
        <Text style={styles.waitingText}>Waiting for bracket to update...</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1B2333",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A4D9B",
    borderLeftWidth: 4,
    borderLeftColor: "#FF6B3D",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1B4332",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#34D399" },
  liveText: { color: "#34D399", fontSize: 10, fontWeight: "800" },
  upcomingBadge: {
    backgroundColor: "#1E3254",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  upcomingText: { color: "#6B9CFF", fontSize: 10, fontWeight: "700" },
  tournamentName: { color: "#F4F7FF", fontSize: 16, fontWeight: "800", flex: 1 },
  arrow: { color: "#637083", fontSize: 16 },
  meta: { color: "#96A3BD", fontSize: 12, marginBottom: 8 },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#141C2B",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#FF6B3D",
  },
  matchIndicator: {
    width: 4,
    height: 28,
    borderRadius: 2,
    backgroundColor: "#FF6B3D",
  },
  matchInfo: { flex: 1 },
  matchRound: { color: "#FF6B3D", fontSize: 11, fontWeight: "700" },
  matchOpponent: { color: "#F4F7FF", fontSize: 15, fontWeight: "800", marginTop: 2 },
  notesBadge: {
    backgroundColor: "#1E3254",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  notesBadgeText: { color: "#6B9CFF", fontSize: 10, fontWeight: "700" },
  viewNotesLink: { color: "#FF6B3D", fontSize: 11, fontWeight: "700" },
  waitingText: { color: "#637083", fontSize: 12, fontStyle: "italic", marginTop: 4 },
});
