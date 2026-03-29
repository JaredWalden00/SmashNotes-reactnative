  // Helper to get the most played character for an opponent across all sets
  function getOpponentMostPlayedCharacter(opponentId, allSets) {
    const charCount = {};
    allSets.forEach(set => {
      if (!set.games) return;
      set.games.forEach(game => {
        game.selections?.forEach(sel => {
          if (sel.character?.name && sel.entrant?.id && String(sel.entrant.id) === String(opponentId)) {
            charCount[sel.character.name] = (charCount[sel.character.name] || 0) + 1;
          }
        });
      });
    });
    let maxChar = null;
    let maxCount = 0;
    for (const char in charCount) {
      if (charCount[char] > maxCount) {
        maxChar = char;
        maxCount = charCount[char];
      }
    }
    return maxChar;
  }
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { useStartGGAuth } from '../lib/startggAuth';

export default function PlayerOpponentsTab({ onOpponentPress }) {
  const { user, isAuthenticated, isLoading: authLoading, accessToken } = useStartGGAuth();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch recent sets for the authenticated user
  useEffect(() => {
    const fetchSets = async () => {
      if (!user?.player?.id) return;
      setLoading(true);
      setError(null);
      try {
        if (!accessToken) {
          setError('No access token available. Please re-authenticate.');
          setLoading(false);
          return;
        }
        const requestBody = {
          query: `
            query RecentSets($playerId: ID!) {
              player(id: $playerId) {
                id
                gamerTag
                sets(perPage: 20, page: 1) {
                  nodes {
                    id
                    displayScore
                    event { id name tournament { id name } }
                    slots {
                      entrant {
                        id
                        name
                        participants { id gamerTag }
                      }
                    }
                    games {
                      id
                      selections {
                        id
                        entrant { id }
                        character { id name }
                      }
                    }
                  }
                }
              }
            }
          `,
          variables: { playerId: user.player.id },
        };
        const response = await fetch('https://api.start.gg/gql/alpha', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(requestBody),
        });
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (parseErr) {
          setError('Failed to parse response: ' + text);
          return;
        }
        if (!response.ok) {
          setError(`HTTP ${response.status}: ${data?.errors?.[0]?.message || text}`);
          console.error('Request body:', requestBody);
          console.error('Response:', data);
          return;
        }
        if (data.errors) {
          setError(data.errors[0].message);
          console.error('Request body:', requestBody);
          console.error('Response:', data);
          return;
        }
        setSets(data.data?.player?.sets?.nodes || []);
      } catch (err) {
        setError(err.message || 'Failed to fetch sets');
      } finally {
        setLoading(false);
      }
    };
    if (isAuthenticated && user?.player?.id) {
      fetchSets();
    }
  }, [isAuthenticated, user]);


  // Helper to get opponent gamerTags for a set
  const getOpponents = (set) => {
    if (!user?.player?.id) return [];
    const opponents = [];
    set.slots?.forEach(slot => {
      slot.entrant?.participants?.forEach(part => {
        if (String(part.id) !== String(user.player.id)) {
          opponents.push({
            id: part.id,
            gamerTag: part.gamerTag
          });
        }
      });
    });
    return opponents;
  };

  // Helper to get the character(s) an opponent played in a specific set
  const getOpponentCharactersInSet = (set, opponentId) => {
    if (!set.games) return [];
    // Find the slot.entrant.id for this opponent
    let opponentEntrantId = null;
    set.slots?.forEach(slot => {
      if (slot.entrant?.participants?.some(part => String(part.id) === String(opponentId))) {
        opponentEntrantId = String(slot.entrant.id);
      }
    });
    if (!opponentEntrantId) return [];
    const chars = new Set();
    set.games.forEach(game => {
      game.selections?.forEach(sel => {
        if (sel.character?.name && String(sel.entrant?.id) === opponentEntrantId) {
          chars.add(sel.character.name);
        }
      });
    });
    return Array.from(chars);
  };

  // Helper to get opponent characters for a set
  const getOpponentCharacters = (set) => {
    if (!user?.player?.id || !set.games) return [];
    // Find all slot.entrant.id values that are not the user's entrant
    const opponentEntrantIds = new Set();
    set.slots?.forEach(slot => {
      // If any participant in this slot is not the user, treat this slot as an opponent
      const isOpponent = slot.entrant?.participants?.every(part => String(part.id) !== String(user.player.id));
      if (isOpponent && slot.entrant?.id) {
        opponentEntrantIds.add(String(slot.entrant.id));
      }
    });
    // Collect all unique character names played by opponents in all games
    const chars = new Set();
    set.games.forEach(game => {
      game.selections?.forEach(sel => {
        if (sel.character?.name && sel.entrant?.id && opponentEntrantIds.has(String(sel.entrant.id))) {
          chars.add(sel.character.name);
        }
      });
    });
    return Array.from(chars);
  };

  if (authLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text>Loading authentication...</Text>
      </View>
    );
  }
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text>Please log in to view your recent sets.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Recent Sets</Text>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={sets}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.setCard}>
              <Text style={styles.setEvent}>{item.event?.tournament?.name} - {item.event?.name}</Text>
              <Text style={styles.setScore}>Score: {item.displayScore}</Text>
              <Text style={styles.setOpponents}>
                <Text>Opponent(s): </Text>
                {getOpponents(item).length > 0 ?
                  getOpponents(item).map((o, idx, arr) => {
                    const chars = getOpponentCharactersInSet(item, o.id);
                    return (
                      <React.Fragment key={o.id}>
                        <Text
                          style={{ color: onOpponentPress ? '#007AFF' : '#333', textDecorationLine: onOpponentPress ? 'underline' : 'none' }}
                          onPress={() => {
                            if (onOpponentPress) {
                              console.log('[Opponent Click] Searching for gamerTag:', o.gamerTag);
                              onOpponentPress(o.gamerTag);
                            }
                          }}
                        >
                          {o.gamerTag}
                        </Text>
                        {/* Show character(s) played by this opponent in this set */}
                        <Text style={{ color: '#888', fontSize: 12 }}>
                          {' '}[
                          {item.games === null ? 'No game data'
                            : chars.length > 0 ? chars.join(', ')
                            : 'No character data'}
                          ]
                        </Text>
                        {idx < arr.length - 1 ? <Text>, </Text> : null}
                      </React.Fragment>
                    );
                  })
                  : <Text>Unknown</Text>}
              </Text>
              <Text style={styles.setCharacters}>
                <Text>Character(s): </Text>
                {item.games === null
                  ? 'No game data'
                  : getOpponentCharacters(item).length > 0
                    ? getOpponentCharacters(item).join(', ')
                    : 'Unknown'}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text>No recent sets found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  error: {
    color: 'red',
    marginVertical: 8,
  },
  setCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  setEvent: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  setScore: {
    marginBottom: 2,
  },
  setOpponents: {
    color: '#333',
  },
});
