import { useState, useEffect, useCallback, useMemo } from "react";
import { Alert } from "react-native";
import {
  searchTournaments,
  getTournament,
  getTournamentEvents,
  searchPlayers,
  getEventSets,
  getPlayerSets,
  getCharacterStats,
  testStartGGConnection,
  getUserRegisteredTournaments,
  getTournamentsForDates,
  getSmashUltimateTournaments,
  VIDEOGAME_IDS
} from "../utils/startggData";
import { startggApi } from "../lib/startgg";

/**
 * Hook for managing Start.gg tournament data
 */
export function useStartGGTournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const searchForTournaments = useCallback(async (query, options = {}) => {
    if (!query.trim()) {
      setTournaments([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await searchTournaments(query, options);
      setTournaments(results.nodes || []);
    } catch (err) {
      setError(err.message);
      console.error("Tournament search error:", err);
      Alert.alert("Tournament Search Error", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setTournaments([]);
    setSearchQuery("");
    setError(null);
  }, []);

  return {
    tournaments,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    searchForTournaments,
    clearSearch
  };
}

/**
 * Hook for managing detailed tournament data
 */
export function useStartGGTournament(tournamentSlug) {
  const [tournament, setTournament] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTournament = useCallback(async (slug) => {
    if (!slug) return;

    setLoading(true);
    setError(null);

    try {
      const [tournamentData, eventsData] = await Promise.all([
        getTournament(slug),
        getTournamentEvents(slug, VIDEOGAME_IDS.SMASH_ULTIMATE)
      ]);

      setTournament(tournamentData);
      setEvents(eventsData || []);
    } catch (err) {
      setError(err.message);
      Alert.alert("Error", `Failed to load tournament: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tournamentSlug) {
      loadTournament(tournamentSlug);
    }
  }, [tournamentSlug, loadTournament]);

  const smashUltimateEvents = useMemo(() => {
    return events.filter(event => 
      event.videogame?.id === VIDEOGAME_IDS.SMASH_ULTIMATE ||
      event.videogame?.slug === "game/super-smash-bros-ultimate"
    );
  }, [events]);

  return {
    tournament,
    events,
    smashUltimateEvents,
    loading,
    error,
    retry: () => loadTournament(tournamentSlug)
  };
}

/**
 * Hook for managing player search and data
 */
export function useStartGGPlayer() {
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerSets, setPlayerSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [setsLoading, setSetsLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchForPlayers = useCallback(async (gamerTag) => {
    if (!gamerTag.trim()) {
      setPlayers([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await searchPlayers(gamerTag);
      setPlayers(results);
    } catch (err) {
      setError(err.message);
      Alert.alert("Error", `Failed to search players: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlayerSets = useCallback(async (playerSlug, options = {}) => {
    if (!playerSlug) return;

    setSetsLoading(true);
    setError(null);

    try {
      const sets = await getPlayerSets(playerSlug, options);
      setPlayerSets(sets);
    } catch (err) {
      setError(err.message);
      Alert.alert("Error", `Failed to load player sets: ${err.message}`);
    } finally {
      setSetsLoading(false);
    }
  }, []);

  const selectPlayer = useCallback((player) => {
    setSelectedPlayer(player);
    if (player?.slug) {
      loadPlayerSets(player.slug);
    }
  }, [loadPlayerSets]);

  const clearSearch = useCallback(() => {
    setPlayers([]);
    setSelectedPlayer(null);
    setPlayerSets([]);
    setError(null);
  }, []);

  // Calculate character stats for the selected player
  const characterStats = useMemo(() => {
    if (!playerSets.length) return null;
    return getCharacterStats(playerSets);
  }, [playerSets]);

  return {
    players,
    selectedPlayer,
    playerSets,
    characterStats,
    loading,
    setsLoading,
    error,
    searchForPlayers,
    loadPlayerSets,
    selectPlayer,
    clearSearch
  };
}

/**
 * Hook for managing tournament bracket/sets data
 */
export function useStartGGSets(eventId) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 0 });
  const [currentPage, setCurrentPage] = useState(1);

  const loadSets = useCallback(async (page = 1, options = {}) => {
    if (!eventId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getEventSets(eventId, { ...options, page });
      setSets(prevSets => page === 1 ? result.nodes : [...prevSets, ...result.nodes]);
      setPageInfo(result.pageInfo);
      setCurrentPage(page);
    } catch (err) {
      setError(err.message);
      Alert.alert("Error", `Failed to load sets: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const loadMoreSets = useCallback(() => {
    if (currentPage < pageInfo.totalPages && !loading) {
      loadSets(currentPage + 1);
    }
  }, [currentPage, pageInfo.totalPages, loading, loadSets]);

  const refreshSets = useCallback(() => {
    setSets([]);
    setCurrentPage(1);
    loadSets(1);
  }, [loadSets]);

  useEffect(() => {
    if (eventId) {
      refreshSets();
    }
  }, [eventId, refreshSets]);

  // Calculate character usage from sets
  const characterStats = useMemo(() => {
    if (!sets.length) return null;
    return getCharacterStats(sets);
  }, [sets]);

  const hasMoreSets = currentPage < pageInfo.totalPages;

  return {
    sets,
    characterStats,
    loading,
    error,
    hasMoreSets,
    currentPage,
    totalPages: pageInfo.totalPages,
    totalSets: pageInfo.total,
    loadMoreSets,
    refreshSets,
    retry: refreshSets
  };
}

/**
 * Hook for checking Start.gg API connectivity
 */
export function useStartGGConnection() {
  const [isConnected, setIsConnected] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [checking, setChecking] = useState(false);

  const checkConnection = useCallback(async () => {
    setChecking(true);

    try {
      const result = await startggApi.healthCheck();
      setIsConnected(result.status === "ok");
      setIsAuthenticated(result.authenticated);
      setConnectionError(result.error || null);
    } catch (err) {
      setIsConnected(false);
      setIsAuthenticated(false);
      setConnectionError(err.message);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  return {
    isConnected,
    isAuthenticated,
    connectionError,
    checking,
    checkConnection
  };
}

/**
 * Hook for managing Start.gg data integrated with your existing notes
 */
export function useStartGGIntegration() {
  const [tournamentNotes, setTournamentNotes] = useState(new Map());
  const [playerNotes, setPlayerNotes] = useState(new Map());
  const [matchupData, setMatchupData] = useState(new Map());

  // Add tournament-specific notes
  const addTournamentNote = useCallback((tournamentId, note) => {
    setTournamentNotes(prev => new Map(prev).set(tournamentId, {
      ...prev.get(tournamentId),
      ...note,
      updatedAt: Date.now()
    }));
  }, []);

  // Add player-specific notes
  const addPlayerNote = useCallback((playerId, note) => {
    setPlayerNotes(prev => new Map(prev).set(playerId, {
      ...prev.get(playerId),
      ...note,
      updatedAt: Date.now()
    }));
  }, []);

  // Process sets to extract matchup insights
  const processMatchupData = useCallback((sets, playerTag) => {
    const matchups = new Map();
    
    sets.forEach(set => {
      const isPlayer1 = set.entrant1.participants.some(p => p.gamerTag === playerTag);
      const opponent = isPlayer1 ? set.entrant2 : set.entrant1;
      const playerWon = (isPlayer1 && set.winnerId === set.entrant1.id) || 
                       (!isPlayer1 && set.winnerId === set.entrant2.id);

      set.games?.forEach(game => {
        const playerSelection = game.selections?.find(s => 
          isPlayer1 ? s.entrant.id === set.entrant1.id : s.entrant.id === set.entrant2.id
        );
        const opponentSelection = game.selections?.find(s => 
          isPlayer1 ? s.entrant.id === set.entrant2.id : s.entrant.id === set.entrant1.id
        );

        if (playerSelection?.character && opponentSelection?.character) {
          const matchupKey = `${playerSelection.character.name}_vs_${opponentSelection.character.name}`;
          const current = matchups.get(matchupKey) || { 
            playerCharacter: playerSelection.character.name,
            opponentCharacter: opponentSelection.character.name,
            wins: 0,
            losses: 0,
            sets: []
          };

          if (playerWon) current.wins++;
          else current.losses++;

          current.sets.push({
            setId: set.id,
            tournament: set.event?.tournament?.name,
            stage: game.stage?.name,
            date: set.completedAt
          });

          matchups.set(matchupKey, current);
        }
      });
    });

    setMatchupData(matchups);
    return matchups;
  }, []);

  // Generate insights for your SmashNotes based on Start.gg data
  const generateInsights = useCallback((characterStats, matchupData) => {
    const insights = [];

    // Most played characters
    const sortedUsage = Object.entries(characterStats.characterUsage || {})
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    if (sortedUsage.length > 0) {
      insights.push({
        type: "character_usage",
        title: "Most Played Characters",
        data: sortedUsage.map(([char, count]) => ({
          character: char,
          games: count,
          winRate: characterStats.winRates[char] || 0
        }))
      });
    }

    // Difficult matchups (low win rate with decent sample size)
    const difficultMatchups = Array.from(matchupData.values())
      .filter(mu => (mu.wins + mu.losses) >= 3) // At least 3 games
      .sort((a, b) => (a.wins / (a.wins + a.losses)) - (b.wins / (b.wins + b.losses)))
      .slice(0, 5);

    if (difficultMatchups.length > 0) {
      insights.push({
        type: "difficult_matchups",
        title: "Challenging Matchups",
        data: difficultMatchups.map(mu => ({
          matchup: `${mu.playerCharacter} vs ${mu.opponentCharacter}`,
          winRate: ((mu.wins / (mu.wins + mu.losses)) * 100).toFixed(1),
          sampleSize: mu.wins + mu.losses
        }))
      });
    }

    return insights;
  }, []);

  return {
    tournamentNotes,
    playerNotes,
    matchupData,
    addTournamentNote,
    addPlayerNote,
    processMatchupData,
    generateInsights
  };
}

/**
 * Hook for managing tournament schedule on the dashboard
 */
export function useStartGGSchedule() {
  const [tournamentsByDate, setTournamentsByDate] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTournamentsForWeek = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Generate dates for the next 7 days starting from today
      const dates = [];
      const today = new Date();
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date);
      }

      const tournaments = await getTournamentsForDates(dates);
      setTournamentsByDate(tournaments);
    } catch (err) {
      setError(err.message);
      console.error('Error loading tournament schedule:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load tournaments when the hook is first used
  useEffect(() => {
    loadTournamentsForWeek();
  }, [loadTournamentsForWeek]);

  // Get tournaments for a specific date
  const getTournamentsForDate = useCallback((date) => {
    const dateKey = date.toISOString().split('T')[0];
    return tournamentsByDate[dateKey] || [];
  }, [tournamentsByDate]);

  // Get tournaments for today specifically
  const getTournamentsForToday = useCallback(() => {
    const today = new Date();
    return getTournamentsForDate(today);
  }, [getTournamentsForDate]);

  return {
    tournamentsByDate,
    loading,
    error,
    loadTournamentsForWeek,
    getTournamentsForDate,
    getTournamentsForToday
  };
}