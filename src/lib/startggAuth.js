import { AuthRequest, makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Complete the auth session
WebBrowser.maybeCompleteAuthSession();

const START_GG_AUTH_ENDPOINT = 'https://start.gg/oauth/authorize';
const START_GG_TOKEN_ENDPOINT = 'https://api.start.gg/oauth/access_token';
const START_GG_REFRESH_ENDPOINT = 'https://api.start.gg/oauth/refresh';

export class StartGGAuth {
  constructor() {
    this.clientId = process.env.EXPO_PUBLIC_START_GG_CLIENT_ID;
    this.clientSecret = process.env.START_GG_CLIENT_SECRET;
    // Use the EXACT redirect URI configured in Start.gg OAuth app
    this.redirectUri = 'https://example.com/auth/callback';
    
    // Debug: Log the redirect URI being used  
    console.log('OAuth Config:');
    console.log('- Client ID:', this.clientId);
    console.log('- Redirect URI:', this.redirectUri);
  }

  // Configure OAuth request
  getAuthRequest() {
    const request = new AuthRequest({
      clientId: this.clientId,
      scopes: ['user.identity', 'user.email'], // Official Start.gg supported scopes
      redirectUri: this.redirectUri,
      responseType: 'code',
    });
    
    return request;
  }

  // Exchange authorization code for access token (following Start.gg documentation)
  async exchangeCodeForToken(code) {
    try {
      const response = await fetch(START_GG_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_secret: this.clientSecret,
          code: code,
          scope: 'user.identity user.email', // Space-separated as per documentation
          client_id: this.clientId,
          redirect_uri: this.redirectUri,
        }),
      });

      const data = await response.json();
      console.log('Token exchange response:', data);
      
      if (data.access_token) {
        // Store tokens securely
        await AsyncStorage.setItem('startgg_access_token', data.access_token);
        await AsyncStorage.setItem('startgg_refresh_token', data.refresh_token || '');
        await AsyncStorage.setItem('startgg_token_expires', 
          String(Date.now() + (data.expires_in * 1000)));
        return data.access_token;
      }
      
      throw new Error(data.error_description || data.error || 'Failed to exchange code for token');
    } catch (error) {
      console.error('OAuth token exchange failed:', error);
      throw error;
    }
  }

  // Refresh access token using refresh token (following Start.gg documentation)
  async refreshAccessToken() {
    try {
      const refreshToken = await AsyncStorage.getItem('startgg_refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(START_GG_REFRESH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: 'user.identity user.email', // Same scopes as original request
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
        }),
      });

      const data = await response.json();
      console.log('Token refresh response:', data);
      
      if (data.access_token) {
        // Store the new tokens
        await AsyncStorage.setItem('startgg_access_token', data.access_token);
        await AsyncStorage.setItem('startgg_refresh_token', data.refresh_token || refreshToken);
        await AsyncStorage.setItem('startgg_token_expires', 
          String(Date.now() + (data.expires_in * 1000)));
        return data.access_token;
      }
      
      throw new Error(data.error_description || data.error || 'Failed to refresh token');
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  // Get access token, refreshing if necessary
  async getAccessToken() {
    try {
      const token = await AsyncStorage.getItem('startgg_access_token');
      const expiresAt = await AsyncStorage.getItem('startgg_token_expires');
      
      if (!token) {
        return null;
      }

      // Check if token is expired or will expire in the next 5 minutes
      if (expiresAt && Date.now() > (parseInt(expiresAt) - 300000)) {
        console.log('Token expired or expiring soon, refreshing...');
        try {
          return await this.refreshAccessToken();
        } catch (error) {
          console.error('Token refresh failed, user needs to re-authenticate');
          await this.logout(); // Clear invalid tokens
          return null;
        }
      }

      return token;
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }

  // Clear stored tokens (logout)
  async logout() {
    try {
      await AsyncStorage.removeItem('startgg_access_token');
      await AsyncStorage.removeItem('startgg_refresh_token');
      await AsyncStorage.removeItem('startgg_token_expires');
      await AsyncStorage.removeItem('startgg_user_info');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  // Check if user is authenticated
  async isAuthenticated() {
    const token = await this.getAccessToken();
    return !!token;
  }
}

// React hook for Start.gg OAuth authentication
export function useStartGGAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  const authService = new StartGGAuth();
  
  // Configure the auth request
  const [request, response, promptAsync] = useAuthRequest(
    authService.getAuthRequest(),
    { authorizationEndpoint: START_GG_AUTH_ENDPOINT }
  );

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Handle OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      handleAuthSuccess(response.params.code);
    } else if (response?.type === 'error') {
      console.error('OAuth error:', response.error);
      setIsLoading(false);
    }
  }, [response]);

  const checkAuthStatus = async () => {
    try {
      const authenticated = await authService.isAuthenticated();
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        // Load user info if available
        const userInfo = await AsyncStorage.getItem('startgg_user_info');
        if (userInfo) {
          setUser(JSON.parse(userInfo));
        }
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = async (code) => {
    try {
      setIsLoading(true);
      const accessToken = await authService.exchangeCodeForToken(code);
      
      // Fetch user info with the new token
      await fetchUserInfo(accessToken);
      
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Authentication failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserInfo = async (accessToken) => {
    try {
      // Use your existing StartGGAPI client but with OAuth token
      const response = await fetch('https://api.start.gg/gql/alpha', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: `
            query CurrentUser {
              currentUser {
                id
                slug
                gamerTag
                email
                player {
                  id
                  gamerTag
                }
              }
            }
          `,
        }),
      });

      const data = await response.json();
      console.log('User info response:', data);
      
      if (data.data?.currentUser) {
        const userInfo = data.data.currentUser;
        await AsyncStorage.setItem('startgg_user_info', JSON.stringify(userInfo));
        setUser(userInfo);
        return userInfo;
      } else if (data.errors) {
        console.error('GraphQL errors when fetching user info:', data.errors);
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
    return null;
  };

  const login = async () => {
    try {
      setIsLoading(true);
      await promptAsync();
    } catch (error) {
      console.error('Login failed:', error);
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    authService,
  };
}