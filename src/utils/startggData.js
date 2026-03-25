import { startggApi } from "../lib/startgg";
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Get OAuth access token if available
 */
async function getOAuthToken() {
  try {
    return await AsyncStorage.getItem('startgg_access_token');
  } catch (error) {
    console.error('Failed to get OAuth token:', error);
    return null;
  }
}

/**
 * Make a GraphQL request with OAuth token if available
 */
async function makeAuthenticatedRequest(query, variables = {}) {
  const oauthToken = await getOAuthToken();
  
  if (oauthToken) {
    // Use OAuth token for authenticated requests
    const response = await fetch('https://api.start.gg/gql/alpha', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${oauthToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    return await response.json();
  } else {
    // Fall back to API token for public data
    return await startggApi.request(query, variables);
  }
}

/**
 * Test function to check basic API connectivity
 * @returns {Promise<Object>} Basic test results
 */
export async function testStartGGConnection() {
  const testQuery = `
    query TestConnection {
      currentUser {
        id
      }
    }
  `;
  
  try {
    const data = await startggApi.request(testQuery);
    return { success: true, message: "API connected successfully", data };
  } catch (error) {
    return { success: false, message: error.message, error };
  }
}

/**
 * Utility functions for interacting with Start.gg tournaments, players, and sets
 */

/**
 * Search for tournaments by name, game, or location
 * @param {string} query - Search query 
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Tournament results
 */
export async function searchTournaments(query, options = {}) {
  const {
    perPage = 20,
    page = 1
  } = options;

  // Basic query that should work with Start.gg API
  const gqlQuery = `
    query SearchTournaments($perPage: Int, $page: Int, $name: String) {
      tournaments(query: {
        perPage: $perPage
        page: $page
        filter: {
          name: $name
        }
      }) {
        nodes {
          id
          name
          slug
          startAt
          isOnline
          numAttendees
          city
          addrState
          events {
            id
            name
            numEntrants
          }
        }
        pageInfo {
          total
          totalPages
        }
      }
    }
  `;

  const variables = {
    perPage,
    page, 
    name: query
  };

  try {
    const data = await startggApi.request(gqlQuery, variables);
    return data.tournaments;
  } catch (error) {
    console.error('Tournament search error:', error);
    // Return a more detailed error for debugging
    throw new Error(`Tournament search failed: ${error.message}. Try searching for specific tournament names like "Genesis" or "EVO".`);
  }
}

/**
 * Get detailed tournament information by ID or slug
 * @param {string} tournamentSlug - Tournament slug or ID
 * @returns {Promise<Object>} Tournament details
 */
export async function getTournament(tournamentSlug) {
  const query = `
    query GetTournament($slug: String!) {
      tournament(slug: $slug) {
        id
        name
        slug
        shortSlug
        startAt
        endAt
        timezone
        isOnline
        numAttendees
        city
        addrState
        countryCode
        currency
        registrationClosesAt
        isRegistrationOpen
        lat
        lng
        venueAddress
        venueName
        primaryContact
        primaryContactType
        images {
          type
          url
          width
          height
        }
        streams {
          id
          streamName
          streamLogo
          streamSource
        }
        events {
          id
          name
          slug
          numEntrants
          startAt
          state
          videogame {
            id
            name
            slug
            displayName
          }
          phases {
            id
            name
            numSeeds
          }
        }
        participants(query: { perPage: 20 }) {
          nodes {
            id
            gamerTag
            prefix
            user {
              id
              slug
              authorizations {
                id
                externalUsername
                type
              }
            }
            entrants {
              id
              name
              event {
                id
                name
              }
            }
          }
        }
      }
    }
  `;

  const data = await startggApi.request(query, { slug: tournamentSlug });
  return data.tournament;
}

/**
 * Get tournament brackets/events for a specific game
 * @param {string} tournamentSlug - Tournament slug
 * @param {number} videogameId - Videogame ID (1386 for Smash Ultimate)
 * @returns {Promise<Array>} Events/brackets
 */
export async function getTournamentEvents(tournamentSlug, videogameId = 1386) {
  const query = `
    query GetTournamentEvents($slug: String!, $videogameId: ID) {
      tournament(slug: $slug) {
        id
        name
        events(filter: { videogameId: $videogameId }) {
          id
          name
          slug
          numEntrants
          startAt
          state
          competitionTier
          videogame {
            id
            name
            displayName
          }
          phases {
            id
            name
            numSeeds
            bracketType
            state
          }
          entrants(query: { perPage: 100 }) {
            nodes {
              id
              name
              initialSeed
              participants {
                id
                gamerTag
                prefix
                user {
                  id
                  slug
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await startggApi.request(query, { 
    slug: tournamentSlug, 
    videogameId: videogameId.toString() 
  });
  return data.tournament?.events || [];
}

/**
 * Search for players by gamer tag
 * @param {string} gamerTag - Player's gamer tag
 * @returns {Promise<Array>} Player search results
 */
export async function searchPlayers(gamerTag) {
  const query = `
    query SearchPlayers($gamerTag: String!) {
      user(slug: $gamerTag) {
        id
        slug
        name
        bio
        birthday
        genderPronoun
        location {
          city
          state
          country
        }
        authorizations {
          id
          externalUsername
          type
        }
        player {
          id
          gamerTag
          prefix
          rankings(videogameId: 1386, limit: 10) {
            id
            rank
            title
          }
        }
        tournaments(query: { perPage: 10 }) {
          nodes {
            id
            name
            slug
            startAt
            numAttendees
          }
        }
      }
    }
  `;

  try {
    const data = await startggApi.request(query, { gamerTag });
    return data.user ? [data.user] : [];
  } catch (error) {
    // If no exact match, try a general search
    return await generalPlayerSearch(gamerTag);
  }
}

/**
 * General player search when exact slug doesn't work
 * @param {string} gamerTag - Search term
 * @returns {Promise<Array>} Player search results
 */
async function generalPlayerSearch(gamerTag) {
  // Note: Start.gg doesn't have a general player search in their public API
  // This would require using tournament participant data
  // For now, return empty array and suggest using tournament-specific searches
  console.warn("General player search not available. Try searching within specific tournaments.");
  return [];
}

/**
 * Get sets (matches) for a tournament event
 * @param {number} eventId - Event ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Sets data
 */
export async function getEventSets(eventId, options = {}) {
  const { perPage = 50, page = 1, sortType = "RECENT" } = options;

  const query = `
    query GetEventSets($eventId: ID!, $perPage: Int, $page: Int, $sortType: SetSortType) {
      event(id: $eventId) {
        id
        name
        sets(
          perPage: $perPage
          page: $page
          sortType: $sortType
        ) {
          nodes {
            id
            displayScore
            fullRoundText
            round
            winnerId
            completedAt
            startedAt
            state
            entrant1 {
              id
              name
              participants {
                id
                gamerTag
                prefix
                user {
                  id
                  slug
                }
              }
            }
            entrant2 {
              id
              name
              participants {
                id
                gamerTag
                prefix
                user {
                  id
                  slug
                }
              }
            }
            games {
              id
              orderNum
              winnerId
              stage {
                id
                name
              }
              selections {
                id
                entrant {
                  id
                  name
                }
                character {
                  id
                  name
                }
              }
            }
          }
          pageInfo {
            total
            totalPages
          }
        }
      }
    }
  `;

  const data = await startggApi.request(query, { 
    eventId: eventId.toString(), 
    perPage, 
    page, 
    sortType 
  });
  return data.event?.sets || { nodes: [], pageInfo: { total: 0, totalPages: 0 } };
}

/**
 * Get player's recent sets across tournaments
 * @param {string} userSlug - Player's slug/ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Player's recent sets
 */
export async function getPlayerSets(userSlug, options = {}) {
  const { perPage = 20, videogameId = 1386 } = options;

  const query = `
    query GetPlayerSets($userSlug: String!, $perPage: Int, $videogameId: ID) {
      user(slug: $userSlug) {
        id
        player {
          id
          sets(perPage: $perPage, filters: { videogameId: $videogameId }) {
            nodes {
              id
              displayScore
              fullRoundText
              winnerId
              completedAt
              event {
                id
                name
                tournament {
                  id
                  name
                  slug
                }
              }
              entrant1 {
                id
                name
                participants {
                  id
                  gamerTag
                  prefix
                }
              }
              entrant2 {
                id
                name
                participants {
                  id
                  gamerTag
                  prefix
                }
              }
              games {
                id
                winnerId
                stage {
                  id
                  name
                }
                selections {
                  character {
                    id
                    name
                  }
                  entrant {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await startggApi.request(query, { 
    userSlug, 
    perPage,
    videogameId: videogameId.toString() 
  });
  return data.user?.player?.sets?.nodes || [];
}

/**
 * Get character usage statistics from a set of games
 * @param {Array} sets - Array of sets with game data
 * @returns {Object} Character usage statistics
 */
export function getCharacterStats(sets) {
  const characterUsage = {};
  const characterWins = {};
  const matchups = {};

  sets.forEach(set => {
    set.games?.forEach(game => {
      game.selections?.forEach(selection => {
        const characterName = selection.character?.name;
        const entrantId = selection.entrant?.id;
        const isWinner = game.winnerId === entrantId;

        if (characterName) {
          // Track usage
          characterUsage[characterName] = (characterUsage[characterName] || 0) + 1;
          
          // Track wins
          if (isWinner) {
            characterWins[characterName] = (characterWins[characterName] || 0) + 1;
          }
        }
      });

      // Track matchups
      if (game.selections?.length === 2) {
        const char1 = game.selections[0]?.character?.name;
        const char2 = game.selections[1]?.character?.name;
        
        if (char1 && char2 && char1 !== char2) {
          const matchupKey = [char1, char2].sort().join(' vs ');
          matchups[matchupKey] = (matchups[matchupKey] || 0) + 1;
        }
      }
    });
  });

  return {
    characterUsage,
    characterWins,
    matchups,
    winRates: Object.keys(characterUsage).reduce((rates, char) => {
      rates[char] = characterUsage[char] > 0 ? 
        ((characterWins[char] || 0) / characterUsage[char]) * 100 : 0;
      return rates;
    }, {})
  };
}

/**
 * Common videogame IDs for Start.gg
 */
export const VIDEOGAME_IDS = {
  SMASH_ULTIMATE: 1386,
  SMASH_MELEE: 1,
  SMASH_64: 4,
  SMASH_BRAWL: 5,
  SMASH_4: 3,
  TEKKEN_7: 23,
  STREET_FIGHTER_6: 43868,
  GUILTY_GEAR_STRIVE: 33945
};

/**
 * Get tournaments that the current user is registered for
 * Requires OAuth authentication for real user data
 * @param {Object} options - Query options
 * @returns {Promise<Array>} User's registered tournaments
 */
export async function getUserRegisteredTournaments(options = {}) {
  const { perPage = 50 } = options;
  const oauthToken = await getOAuthToken();
  
  if (!oauthToken) {
    console.warn('OAuth token not available, cannot fetch user tournaments');
    return [];
  }

  // Query to get user's tournament registrations
  const query = `
    query UserTournaments($perPage: Int) {
      currentUser {
        id
        slug
        tournaments(query: {perPage: $perPage}) {
          nodes {
            id
            name
            slug
            startAt
            endAt 
            isOnline
            city
            addrState
            events(filter: {videogameId: 1386}) {
              id
              name
              slug
            }
          }
        }
      }
    }
  `;

  try {
    const response = await makeAuthenticatedRequest(query, { perPage });
    
    if (response.errors) {
      console.error('GraphQL errors:', response.errors);
      return [];
    }

    const tournaments = response.data?.currentUser?.tournaments?.nodes || [];
    
    // Transform to match expected format
    return tournaments.map(tournament => ({
      ...tournament,
      smashEvents: tournament.events || []
    }));
  } catch (error) {
    console.error('Error fetching user tournaments:', error);
    return [];
  }
}

/**
 * Get tournaments for specific dates
 * Uses real user data if OAuth is available, otherwise shows mock tournaments
 * @param {Array} dates - Array of date objects to check
 * @returns {Promise<Object>} Tournaments grouped by date
 */
export async function getTournamentsForDates(dates) {
  try {
    const oauthToken = await getOAuthToken();
    let tournaments = [];

    if (oauthToken) {
      // Use real user tournament data
      tournaments = await getUserRegisteredTournaments();
    } else {
      // Fall back to mock tournaments for demonstration
      tournaments = [
        {
          id: 'demo-1',
          name: 'Genesis 11',
          slug: 'genesis-11', 
          isOnline: false,
          city: 'San Jose',
          addrState: 'CA',
          startAt: Math.floor(new Date().getTime() / 1000) + (86400 * 2), // 2 days from now
          smashEvents: [
            { id: '1', name: 'Super Smash Bros. Ultimate Singles' },
            { id: '2', name: 'Super Smash Bros. Ultimate Doubles' }
          ]
        },
        {
          id: 'demo-2', 
          name: 'Local Weekly',
          slug: 'local-weekly',
          isOnline: false,
          city: 'Your City',
          addrState: 'Your State',
          startAt: Math.floor(new Date().getTime() / 1000) + (86400 * 5), // 5 days from now
          smashEvents: [
            { id: '3', name: 'SSBU Singles' }
          ]
        },
        {
          id: 'demo-3',
          name: 'Online Netplay',
          slug: 'online-netplay',
          isOnline: true,
          city: null,
          addrState: null,
          startAt: Math.floor(new Date().getTime() / 1000) + 86400, // Tomorrow
          smashEvents: [
            { id: '4', name: 'Ultimate Online' }
          ]
        }
      ];
    }
    
    const tournamentsByDate = {};
    
    dates.forEach(date => {
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      tournamentsByDate[dateKey] = [];
      
      tournaments.forEach(tournament => {
        const tournamentDate = new Date(tournament.startAt * 1000);
        const targetDate = new Date(date);
        
        // Check if tournament is on this date
        if (tournamentDate.toDateString() === targetDate.toDateString()) {
          tournamentsByDate[dateKey].push(tournament);
        }
      });
    });
    
    return tournamentsByDate;
  } catch (error) {
    console.error('Error getting tournaments for dates:', error);
    return {};
  }
}

/**
 * Helper to get Smash Ultimate events specifically
 */
export const getSmashUltimateTournaments = (query, options = {}) =>
  searchTournaments(query, { ...options, videogameId: VIDEOGAME_IDS.SMASH_ULTIMATE });

export const getSmashUltimateEvents = (tournamentSlug) =>
  getTournamentEvents(tournamentSlug, VIDEOGAME_IDS.SMASH_ULTIMATE);