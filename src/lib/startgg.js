import { Platform } from "react-native";

const START_GG_API_URL = "https://api.start.gg/gql/alpha";
const START_GG_API_TOKEN = process.env.EXPO_PUBLIC_START_GG_API_TOKEN;

if (!START_GG_API_TOKEN) {
  console.warn(
    "Missing Start.gg API token. Set EXPO_PUBLIC_START_GG_API_TOKEN in your environment variables."
  );
}

/**
 * Main Start.gg API client for making GraphQL requests
 */
class StartGGAPI {
  constructor() {
    this.apiUrl = START_GG_API_URL;
    this.token = START_GG_API_TOKEN;
  }

  /**
   * Make a GraphQL request to Start.gg API
   * @param {string} query - GraphQL query string
   * @param {Object} variables - Query variables
   * @param {string} operationName - Operation name (optional)
   * @returns {Promise<Object>} Response data
   */
  async request(query, variables = {}, operationName = null) {
    if (!this.token) {
      throw new Error("Start.gg API token not configured");
    }

    const requestBody = {
      query,
      variables,
      ...(operationName && { operationName })
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.token}`,
          ...Platform.select({
            web: {
              "User-Agent": "SmashNotes-ReactNative/1.0.0"
            },
            default: {}
          })
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid Start.gg API token");
        }
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.errors && data.errors.length > 0) {
        const errorMessage = data.errors.map(err => err.message).join(", ");
        throw new Error(`GraphQL Error: ${errorMessage}`);
      }

      return data.data;
    } catch (error) {
      console.error("Start.gg API Request Error:", error);
      throw error;
    }
  }

  /**
   * Check if the API is available and token is valid
   */
  async healthCheck() {
    // Use a very simple query to test the connection
    const query = `
      query HealthCheck {
        currentUser {
          id
        }
      }
    `;

    try {
      const data = await this.request(query);
      return { status: "ok", authenticated: true, data };
    } catch (error) {
      console.log("Health check error details:", error);
      
      if (error.message.includes("Invalid") || error.message.includes("401")) {
        return { status: "error", authenticated: false, error: "Invalid API token" };
      }
      if (error.message.includes("403")) {
        return { status: "error", authenticated: false, error: "Access denied - check token permissions" };
      }
      if (error.message.includes("GraphQL Error")) {
        // API is working but query might be wrong - this means we're connected
        return { status: "ok", authenticated: true, error: "Connected but query needs adjustment" };
      }
      return { status: "error", authenticated: false, error: error.message };
    }
  }
}

// Export singleton instance
export const startggApi = new StartGGAPI();

// Export the class for testing or custom instances
export { StartGGAPI };