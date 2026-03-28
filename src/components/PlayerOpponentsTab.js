import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { useStartGGAuth } from '../lib/startggAuth';

export default function PlayerOpponentsTab() {
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
                sets(perPage: 100, page: 1) {
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

  // Helper to get opponent characters for a set
  const getOpponentCharacters = (set) => {
    if (!user?.player?.id || !set.games) return [];
    const opponentIds = new Set();
    set.slots?.forEach(slot => {
      slot.entrant?.participants?.forEach(part => {
        if (String(part.id) !== String(user.player.id)) {
          opponentIds.add(String(part.id));
        }
      });
    });
    // Collect all unique character names played by opponents in all games
    const chars = new Set();
    set.games.forEach(game => {
      game.selections?.forEach(sel => {
        if (sel.character?.name && sel.entrant?.id && opponentIds.has(String(sel.entrant.id))) {
          chars.add(sel.character.name);
        }
      });
    });
    return Array.from(chars);
  };

  if (authLoading) {
    return <View style={styles.container}><ActivityIndicator size="large" /><Text>Loading authentication...</Text></View>;
  }
  if (!isAuthenticated) {
    return <View style={styles.container}><Text>Please log in to view your recent sets.</Text></View>;
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
                Opponent(s): {getOpponents(item).map(o => o.gamerTag).join(', ') || 'Unknown'}
              </Text>
              <Text style={styles.setCharacters}>
                Character(s): {getOpponentCharacters(item).join(', ') || 'Unknown'}
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
