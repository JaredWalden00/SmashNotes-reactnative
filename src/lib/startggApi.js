// src/lib/startggApi.js
// Centralized service for all start.gg GraphQL API calls

/**
 * Make a GraphQL request to start.gg
 * @param {string} query - GraphQL query string
 * @param {object} variables - Query variables
 * @param {string} accessToken - Bearer token for authentication
 * @returns {Promise<object>} - Parsed data
 * @throws {Error} - On network or API error
 */
export async function startggGraphQL(query, variables, accessToken) {
  const response = await fetch('https://api.start.gg/gql/alpha', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error('Failed to parse response: ' + text);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${data?.errors?.[0]?.message || text}`);
  }
  if (data.errors) {
    throw new Error(data.errors[0].message);
  }
  return data.data;
}

/**
 * Fetch recent sets for a player (with games, slots, etc.)
 * @param {string} playerId
 * @param {string} accessToken
 * @returns {Promise<Array>} - Array of set nodes
 */
export async function fetchRecentSets(playerId, accessToken) {
  const query = `
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
  `;
  const data = await startggGraphQL(query, { playerId }, accessToken);
  return data?.player?.sets?.nodes || [];
}


/**
 * Fetch the 3 most recent unique characters played by a player.
 * @param {string} playerId
 * @param {string} accessToken
 * @returns {Promise<Array>} - Array of up to 3 character objects { id, name }
 */
export async function fetchRecentCharacters(playerId, accessToken) {
  // Fetch recent sets with games and selections
  const sets = await fetchRecentSets(playerId, accessToken);
  if (typeof console !== 'undefined') {
    console.log('[fetchRecentCharacters] sets:', JSON.stringify(sets, null, 2));
  }
  const recentCharacters = [];
  const seen = new Set();

  for (const set of sets) {
    if (!set.games || !Array.isArray(set.games)) continue;

    for (const game of set.games) {
      if (!game.selections || !Array.isArray(game.selections)) continue;
      for (const selection of game.selections) {
        const char = selection.character;
        if (!char || !char.id || !char.name) continue;
        if (!seen.has(char.id)) {
          recentCharacters.push({ id: char.id, name: char.name });
          seen.add(char.id);
          if (recentCharacters.length === 3) return recentCharacters;
        }
      }
    }
  }
  return recentCharacters;
}
