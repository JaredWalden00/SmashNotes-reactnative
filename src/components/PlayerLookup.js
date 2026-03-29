import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView
} from "react-native";
import { useStartGGPlayer } from "../hooks/useStartGG";
import { SMASH_FIGHTERS } from "../data/smashFighters";


export default function PlayerLookup({ onCreateNote, searchQuery: externalSearchQuery }) {
  const {
    players,
    selectedPlayer,
    playerSets,
    characterStats,
    loading,
    setsLoading,
    error,
    searchForPlayers,
    selectPlayer,
    clearSearch
  } = useStartGGPlayer();

  const [searchQuery, setSearchQuery] = useState(externalSearchQuery || "");

  // If the searchQuery prop changes, update local state and trigger search
  React.useEffect(() => {
    if (externalSearchQuery && externalSearchQuery !== searchQuery) {
      setSearchQuery(externalSearchQuery);
      searchForPlayers(externalSearchQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSearchQuery]);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      Alert.alert("Error", "Please enter a player tag to search");
      return;
    }
    searchForPlayers(searchQuery);
  };

  const handleCreateNote = (character, opponent = null) => {
    if (!selectedPlayer) return;

    const noteData = {
      title: `vs ${selectedPlayer.player?.gamerTag || selectedPlayer.slug}${character ? ` (${character})` : ''}`,
      character: character || "General",
      opponent: selectedPlayer.player?.gamerTag || selectedPlayer.slug,
      category: "matchup",
      body: generateNoteTemplate(selectedPlayer, character, opponent)
    };

    onCreateNote?.(noteData);
  };

  const generateNoteTemplate = (player, character, opponent) => {
    const stats = characterStats?.characterUsage || {};
    const mostPlayed = Object.entries(stats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([char]) => char);

    return `## Player Analysis: ${player.player?.gamerTag || player.slug}

### Tournament Results
${playerSets.length > 0 ? 
  `Recent sets: ${playerSets.length} matches analyzed` : 
  'No recent tournament data available'}

### Character Usage
${mostPlayed.length > 0 ? 
  mostPlayed.map(char => `- ${char}`).join('\n') : 
  'No character data available'}

### Notes
- Strengths:
- Weaknesses:
- Common habits:
- Adaptation notes:

### Matchup Strategy${character ? ` (${character})` : ''}
- Neutral game:
- Punish game:
- Recovery/edge guarding:
- Stage preferences:

### Set History
${playerSets.slice(0, 3).map(set => {
  const tournament = set.event?.tournament?.name || 'Unknown Tournament';
  const score = set.displayScore || 'N/A';
  return `- ${tournament}: ${score}`;
}).join('\n')}

---
*Generated from Start.gg data on ${new Date().toLocaleDateString()}*`;
  };

  const renderPlayer = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.playerItem,
        selectedPlayer?.id === item.id && styles.selectedPlayerItem
      ]}
      onPress={() => selectPlayer(item)}
    >
      <View style={styles.playerHeader}>
        <Text style={styles.playerName}>
          {item.player?.prefix ? `${item.player.prefix} | ` : ''}
          {item.player?.gamerTag || item.slug}
        </Text>
        {item.location && (
          <Text style={styles.locationText}>
            📍 {item.location.city}, {item.location.state}
          </Text>
        )}
      </View>
      
      {item.player?.rankings && item.player.rankings.length > 0 && (
        <View style={styles.rankingsContainer}>
          <Text style={styles.rankingText}>
            🏆 Ranked #{item.player.rankings[0].rank} - {item.player.rankings[0].title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderCharacterStats = () => {
    if (!characterStats || !characterStats.characterUsage) {
      return null;
    }

    const sortedChars = Object.entries(characterStats.characterUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    return (
      <View style={styles.statsContainer}>
        <Text style={styles.statsHeader}>Character Usage</Text>
        {sortedChars.map(([character, games]) => {
          const winRate = characterStats.winRates[character] || 0;
          return (
            <View key={character} style={styles.characterStatItem}>
              <View style={styles.characterStatRow}>
                <Text style={styles.characterName}>{character}</Text>
                <TouchableOpacity
                  style={styles.createNoteButton}
                  onPress={() => handleCreateNote(character)}
                >
                  <Text style={styles.createNoteButtonText}>Create Note</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.characterStats}>
                {games} games • {winRate.toFixed(1)}% win rate
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderRecentSets = () => {
    if (!playerSets || playerSets.length === 0) {
      return null;
    }

    return (
      <View style={styles.setsContainer}>
        <View style={styles.setsHeader}>
          <Text style={styles.setsHeaderText}>Recent Sets</Text>
          <TouchableOpacity
            style={styles.createGeneralNoteButton}
            onPress={() => handleCreateNote()}
          >
            <Text style={styles.createNoteButtonText}>Create General Note</Text>
          </TouchableOpacity>
        </View>
        
        {playerSets.slice(0, 10).map((set, index) => {
          const tournament = set.event?.tournament?.name || 'Unknown Tournament';
          const opponent = set.entrant1.participants.some(p => 
            p.gamerTag === (selectedPlayer.player?.gamerTag || selectedPlayer.slug)
          ) ? set.entrant2.name : set.entrant1.name;
          
          const isWin = set.winnerId === (
            set.entrant1.participants.some(p => 
              p.gamerTag === (selectedPlayer.player?.gamerTag || selectedPlayer.slug)
            ) ? set.entrant1.id : set.entrant2.id
          );

          return (
            <View key={set.id} style={styles.setItem}>
              <View style={styles.setHeader}>
                <Text style={styles.tournamentName}>{tournament}</Text>
                <Text style={[
                  styles.setResult,
                  isWin ? styles.setWin : styles.setLoss
                ]}>
                  {isWin ? 'W' : 'L'}
                </Text>
              </View>
              <Text style={styles.opponentName}>vs {opponent}</Text>
              <Text style={styles.setScore}>{set.displayScore}</Text>
              {set.completedAt && (
                <Text style={styles.setDate}>
                  {new Date(set.completedAt * 1000).toLocaleDateString()}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search players by gamer tag (e.g., 'MkLeo', 'Tweek')"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        
        <View style={styles.searchButtons}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearSearch}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Searching players...</Text>
        </View>
      )}

      {error && (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}

      {!loading && !error && players.length > 0 && !selectedPlayer && (
        <FlatList
          data={players}
          renderItem={renderPlayer}
          keyExtractor={(item) => item.id.toString()}
          style={styles.playersList}
        />
      )}

      {selectedPlayer && (
        <ScrollView style={styles.playerDetailsContainer}>
          <View style={styles.selectedPlayerHeader}>
            <Text style={styles.selectedPlayerName}>
              {(selectedPlayer.player?.prefix ? selectedPlayer.player.prefix + ' | ' : '') + (selectedPlayer.player?.gamerTag || selectedPlayer.slug)}
            </Text>
            
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => selectPlayer(null)}
            >
              <Text style={styles.backButtonText}>← Back to Search</Text>
            </TouchableOpacity>
          </View>

          {selectedPlayer.bio && (
            <View style={styles.bioContainer}>
              <Text style={styles.bioText}>{selectedPlayer.bio}</Text>
            </View>
          )}

          {setsLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading player data...</Text>
            </View>
          ) : (
            <>
              {renderCharacterStats()}
              {renderRecentSets()}
            </>
          )}
        </ScrollView>
      )}

      {!loading && !error && players.length === 0 && searchQuery && (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No players found</Text>
          <Text style={styles.emptySubtext}>
            Try searching with a different gamer tag
          </Text>
        </View>
      )}

      {!searchQuery && (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>🎮 Player Lookup</Text>
          <Text style={styles.emptySubtext}>
            Search for players to view their tournament history and create notes
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  searchContainer: {
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: 'white'
  },
  searchButtons: {
    flexDirection: 'row',
    gap: 10
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  clearButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  playersList: {
    padding: 15
  },
  playerItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  selectedPlayerItem: {
    borderWidth: 2,
    borderColor: '#007AFF'
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  playerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1
  },
  locationText: {
    fontSize: 14,
    color: '#666'
  },
  rankingsContainer: {
    marginTop: 8
  },
  rankingText: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600'
  },
  playerDetailsContainer: {
    flex: 1,
    padding: 15
  },
  selectedPlayerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  selectedPlayerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1
  },
  backButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6
  },
  backButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600'
  },
  bioContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20
  },
  statsContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  statsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15
  },
  characterStatItem: {
    marginBottom: 12
  },
  characterStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  characterName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1
  },
  characterStats: {
    fontSize: 14,
    color: '#666'
  },
  createNoteButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  createNoteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600'
  },
  setsContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  setsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  setsHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  createGeneralNoteButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  setItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10
  },
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  tournamentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1
  },
  setResult: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  setWin: {
    color: '#28a745',
    backgroundColor: '#d4edda'
  },
  setLoss: {
    color: '#dc3545',
    backgroundColor: '#f8d7da'
  },
  opponentName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2
  },
  setScore: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2
  },
  setDate: {
    fontSize: 12,
    color: '#999'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666'
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center'
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center'
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8
  }
});