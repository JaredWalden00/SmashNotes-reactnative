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
  const sets = data?.player?.sets?.nodes || [];
  sets._playerGamerTag = data?.player?.gamerTag || null;
  return sets;
}

/**
 * Fetch a specific page of sets for a player.
 * @param {string} playerId
 * @param {string} accessToken
 * @param {number} page - 1-indexed page number
 * @param {number} perPage - results per page (max ~20 to stay under complexity limit)
 * @returns {Promise<{sets: Array, gamerTag: string|null, hasMore: boolean}>}
 */
export async function fetchSetsPage(playerId, accessToken, page = 1, perPage = 20) {
  const query = `
    query SetsPage($playerId: ID!, $perPage: Int!, $page: Int!) {
      player(id: $playerId) {
        id
        gamerTag
        sets(perPage: $perPage, page: $page) {
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
  const data = await startggGraphQL(query, { playerId, perPage, page }, accessToken);
  const sets = data?.player?.sets?.nodes || [];
  return {
    sets,
    gamerTag: data?.player?.gamerTag || null,
    hasMore: sets.length === perPage,
  };
}


/**
 * Fetch the 3 most recent unique characters played by a player.
 * @param {string} playerId
 * @param {string} accessToken
 * @returns {Promise<Array>} - Array of up to 3 character objects { id, name }
 */
/**
 * Fetch recent opponents aggregated from a player's sets.
 * Returns up to 8 opponents sorted by sets played (descending).
 * Each opponent includes: gamerTag, playerId, setsPlayed, characters (sorted by frequency).
 */
export async function fetchRecentOpponents(playerId, accessToken) {
  // Fetch sets and also get the player's gamerTag to identify which slot is "us"
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
  const playerGamerTag = data?.player?.gamerTag;
  const sets = data?.player?.sets?.nodes || [];
  const opponentMap = {};
  let orderIndex = 0;

  for (const set of sets) {
    if (!set.slots) continue;

    // Find the user's entrant — try gamerTag match, then entrant name
    let userEntrantId = null;
    if (playerGamerTag) {
      const tagLower = playerGamerTag.toLowerCase();
      for (const slot of set.slots) {
        const match = slot.entrant?.participants?.some(
          (p) => p.gamerTag?.toLowerCase() === tagLower
        ) || slot.entrant?.name?.toLowerCase().includes(tagLower);
        if (match && slot.entrant?.id) {
          userEntrantId = String(slot.entrant.id);
          break;
        }
      }
    }
    if (!userEntrantId) continue;

    // Process only opponent slots
    for (const slot of set.slots) {
      if (!slot.entrant?.id || String(slot.entrant.id) === userEntrantId) continue;

      const participants = slot.entrant?.participants || [];
      const opponent = participants[0];
      if (!opponent) continue;

      const key = String(opponent.id);
      if (!opponentMap[key]) {
        opponentMap[key] = {
          playerId: opponent.id,
          gamerTag: opponent.gamerTag || "Unknown",
          setsPlayed: 0,
          characterCounts: {},
          firstSeen: orderIndex++,
        };
      }
      opponentMap[key].setsPlayed += 1;
      if (opponent.gamerTag) {
        opponentMap[key].gamerTag = opponent.gamerTag;
      }

      // Count characters played by this opponent in this set
      const entrantId = String(slot.entrant.id);
      if (set.games) {
        for (const game of set.games) {
          for (const sel of game.selections || []) {
            if (sel.character?.name && String(sel.entrant?.id) === entrantId) {
              const charName = sel.character.name;
              opponentMap[key].characterCounts[charName] =
                (opponentMap[key].characterCounts[charName] || 0) + 1;
            }
          }
        }
      }
    }
  }

  // Sort by most recent first (lowest firstSeen = most recent set)
  return Object.values(opponentMap)
    .map((opp) => {
      const characters = Object.entries(opp.characterCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);
      return {
        playerId: opp.playerId,
        gamerTag: opp.gamerTag,
        setsPlayed: opp.setsPlayed,
        characters,
        firstSeen: opp.firstSeen,
      };
    })
    .sort((a, b) => a.firstSeen - b.firstSeen)
    .slice(0, 12);
}

/**
 * Fetch the most played-against characters from a player's last 100 sets.
 * Returns characters sorted by frequency (descending) with set counts.
 */
export async function fetchMostPlayedAgainst(playerId, accessToken) {
  const PAGE_SIZE = 20;
  const MAX_SETS = 100;
  const query = `
    query MostPlayedAgainst($playerId: ID!, $perPage: Int!, $page: Int!) {
      player(id: $playerId) {
        id
        gamerTag
        sets(perPage: $perPage, page: $page) {
          nodes {
            id
            slots {
              entrant {
                id
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

  let allSets = [];
  let playerGamerTag = null;

  for (let page = 1; allSets.length < MAX_SETS; page++) {
    const data = await startggGraphQL(query, { playerId, perPage: PAGE_SIZE, page }, accessToken);
    if (!playerGamerTag) playerGamerTag = data?.player?.gamerTag;
    const nodes = data?.player?.sets?.nodes || [];
    if (nodes.length === 0) break;
    allSets = allSets.concat(nodes);
    if (nodes.length < PAGE_SIZE) break;
  }

  const sets = allSets.slice(0, MAX_SETS);
  const charCounts = {};

  for (const set of sets) {
    if (!set.slots || !set.games) continue;

    // Find the user's entrant — try gamerTag match, then entrant name contains gamerTag
    let userEntrantId = null;
    if (playerGamerTag) {
      const tagLower = playerGamerTag.toLowerCase();
      for (const slot of set.slots) {
        const match = slot.entrant?.participants?.some(
          (p) => p.gamerTag?.toLowerCase() === tagLower
        ) || slot.entrant?.name?.toLowerCase().includes(tagLower);
        if (match && slot.entrant?.id) {
          userEntrantId = String(slot.entrant.id);
          break;
        }
      }
    }
    // If we couldn't identify the user, skip this set entirely
    if (!userEntrantId) continue;

    const opponentEntrantIds = new Set();
    for (const slot of set.slots) {
      if (slot.entrant?.id && String(slot.entrant.id) !== userEntrantId) {
        opponentEntrantIds.add(String(slot.entrant.id));
      }
    }

    // Count opponent characters (dedupe per set so one set = one count per character)
    const charsThisSet = new Set();
    for (const game of set.games) {
      for (const sel of game.selections || []) {
        if (sel.character?.name && sel.entrant?.id && opponentEntrantIds.has(String(sel.entrant.id))) {
          charsThisSet.add(sel.character.name);
        }
      }
    }
    for (const charName of charsThisSet) {
      if (!charCounts[charName]) {
        charCounts[charName] = { name: charName, sets: 0 };
      }
      charCounts[charName].sets += 1;
    }
  }

  return Object.values(charCounts)
    .sort((a, b) => b.sets - a.sets);
}
