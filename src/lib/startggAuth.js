import { AuthRequest, makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useState, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Complete the auth session
WebBrowser.maybeCompleteAuthSession();

const START_GG_AUTH_ENDPOINT = 'https://start.gg/oauth/authorize';
const START_GG_TOKEN_ENDPOINT = 'https://api.start.gg/oauth/access_token';
const START_GG_REFRESH_ENDPOINT = 'https://api.start.gg/oauth/refresh';

export class StartGGAuth {
  constructor() {
    const isNative = Platform.OS !== 'web';

    if (isNative) {
      // Native iOS/Android — OAuth redirects to the Express server which handles the exchange
      const debuggerHost = Constants.expoConfig?.hostUri
        || Constants.manifest?.debuggerHost
        || Constants.manifest2?.extra?.expoGo?.debuggerHost
        || '';
      this.lanIp = debuggerHost.split(':')[0] || '192.168.1.55';
      this.clientId = process.env.EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID || '450';
      // Redirect to the Express server's callback handler (port 3001)
      this.redirectUri = `http://${this.lanIp}:3001/auth/native/callback`;
      this.isNative = true;
      console.log('OAuth Config (Native):');
      console.log('- LAN IP from Expo:', this.lanIp);
    } else {
      // Web — detect localhost vs LAN IP
      let hostname = null;
      try {
        if (typeof window !== 'undefined' && window.location) {
          hostname = window.location.hostname || null;
        }
      } catch (e) {}

      const isLocalhost = !hostname || hostname === 'localhost' || hostname === '127.0.0.1';
      const isLAN = hostname && /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
      let origin = null;
      try { origin = window.location.origin; } catch (e) {}

      if (isLocalhost) {
        this.clientId = process.env.EXPO_PUBLIC_START_GG_CLIENT_ID || '442';
        this.redirectUri = 'http://localhost:8081/auth/callback';
      } else if (isLAN) {
        // Mobile web via LAN IP
        this.clientId = process.env.EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID || '450';
        this.redirectUri = `http://${hostname}:8081/auth/callback`;
      } else {
        // Deployed (Vercel, etc.) — use production client ID and origin
        this.clientId = process.env.EXPO_PUBLIC_START_GG_PROD_CLIENT_ID || '455';
        this.redirectUri = `${origin}/auth/callback`;
      }
      this.isNative = false;
      console.log(`OAuth Config (Web ${isLocalhost ? 'Desktop' : isLAN ? 'LAN' : 'Deployed'}):`);
      console.log('- hostname:', hostname);
      console.log('- origin:', origin);
      console.log('- isLocalhost:', isLocalhost);
      console.log('- isLAN:', isLAN);
    }

    console.log('- Client ID:', this.clientId);
    console.log('- Redirect URI:', this.redirectUri);
    console.log('- EXPO_PUBLIC_START_GG_PROD_CLIENT_ID:', process.env.EXPO_PUBLIC_START_GG_PROD_CLIENT_ID);
    console.log('- EXPO_PUBLIC_START_GG_CLIENT_ID:', process.env.EXPO_PUBLIC_START_GG_CLIENT_ID);
  }

  // Return config object for useAuthRequest
  getAuthRequestConfig() {
    return {
      clientId: this.clientId,
      scopes: ['user.identity', 'user.email'],
      redirectUri: this.redirectUri,
      responseType: 'code',
    };
  }

  // Exchange authorization code for access token (following Start.gg documentation)
  async exchangeCodeForToken(code) {
    try {
      // Restore code_verifier — may be lost after a full-page redirect on web
      let codeVerifier = this._lastCodeVerifier || null;
      if (!codeVerifier) {
        codeVerifier = await AsyncStorage.getItem('startgg_code_verifier');
      }

      // Try the backend proxy first, fall back to direct exchange
      let data;
      try {
        // On deployed sites use /api/startgg-exchange, on dev use localhost:3001
        const backendHost = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
        const isDeployed = backendHost && backendHost !== 'localhost' && backendHost !== '127.0.0.1' && !/^\d+\.\d+\.\d+\.\d+$/.test(backendHost);
        const exchangeUrl = isDeployed
          ? `${window.location.origin}/api/startgg-exchange`
          : `http://${backendHost}:3001/api/startgg/exchange`;
        const backendResponse = await fetch(exchangeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            redirect_uri: this.redirectUri,
            code_verifier: codeVerifier,
            client_id: this.clientId,
          }),
        });
        data = await backendResponse.json();
        console.log('Backend token exchange response:', data);

        // If backend returned an error, fall through to direct exchange
        if (data.error || !data.access_token) {
          throw new Error(data.error || 'No access token from backend');
        }
      } catch (backendError) {
        console.log('Backend proxy failed, exchanging directly with Start.gg:', backendError.message);
        const directResponse = await fetch(START_GG_TOKEN_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: this.clientId,
            client_secret: this.clientSecret,
            code,
            redirect_uri: this.redirectUri,
            code_verifier: codeVerifier,
          }),
        });
        data = await directResponse.json();
        console.log('Direct token exchange response:', data);
      }

      if (data.access_token) {
        // Store tokens securely
        await AsyncStorage.setItem('startgg_access_token', data.access_token);
        await AsyncStorage.setItem('startgg_refresh_token', data.refresh_token || '');
        await AsyncStorage.setItem('startgg_token_expires',
          String(Date.now() + (data.expires_in * 1000)));
        // Clean up code verifier
        await AsyncStorage.removeItem('startgg_code_verifier');
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
  const [accessToken, setAccessToken] = useState(null);

  const authService = useMemo(() => new StartGGAuth(), []);

  // Discovery object for expo-auth-session
  const discovery = {
    authorizationEndpoint: START_GG_AUTH_ENDPOINT,
    tokenEndpoint: START_GG_TOKEN_ENDPOINT,
    revocationEndpoint: START_GG_REFRESH_ENDPOINT,
  };

  // Configure the auth request (pass config object, not AuthRequest instance)
  const [request, response, promptAsync] = useAuthRequest(
    authService.getAuthRequestConfig(),
    discovery
  );

  // Save code_verifier for token exchange (persist to AsyncStorage so it
  // survives full-page redirects on web)
  useEffect(() => {
    if (request && request.codeVerifier) {
      authService._lastCodeVerifier = request.codeVerifier;
      AsyncStorage.setItem('startgg_code_verifier', request.codeVerifier).catch(() => {});
    }
  }, [request]);

  // Check authentication status on mount + handle web OAuth redirect
  useEffect(() => {
    // On web, expo-auth-session does a full page redirect.
    // When the page reloads at /auth/callback?code=..., the useAuthRequest
    // response never fires because React state was lost. We need to grab
    // the code from the URL ourselves.
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        // Clean the URL so a page refresh doesn't re-trigger
        window.history.replaceState({}, '', '/');
        handleAuthSuccess(code);
        return; // skip normal checkAuthStatus — handleAuthSuccess will set state
      }
    }

    checkAuthStatus();
  }, []);

  // Handle OAuth response (native platforms where useAuthRequest returns inline)
  useEffect(() => {
  console.log('OAuth response:', response);
  if (response?.type === 'success') {
    handleAuthSuccess(response.params.code);
  } else if (response?.type === 'error') {
    console.error('OAuth error:', response.error);
    setIsLoading(false);
  }
}, [response]);

  const checkAuthStatus = async () => {
    try {
      const token = await authService.getAccessToken();
      setAccessToken(token);
      const authenticated = !!token;
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
      console.log('OAuth code received:', code);
      const token = await authService.exchangeCodeForToken(code);
      setAccessToken(token);
      console.log('Access token received:', token);
      const user = await fetchUserInfo(token);
      console.log('Fetched user info:', user);
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
                email
                name
                discriminator
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
    if (authService.isNative) {
      // Native: open browser to Start.gg OAuth, redirect to our server
      const authUrl = `https://start.gg/oauth/authorize?response_type=code&client_id=${authService.clientId}&scope=user.identity%20user.email&redirect_uri=${encodeURIComponent(authService.redirectUri)}`;
      console.log('Opening native OAuth:', authUrl);
      await WebBrowser.openBrowserAsync(authUrl);

      // After browser closes, poll the server for the token
      console.log('Browser closed, polling for token...');
      const serverHost = authService.lanIp || 'localhost';
      for (let i = 0; i < 12; i++) { // Poll for up to 60 seconds
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const resp = await fetch(`http://${serverHost}:3001/auth/native/token`);
          const data = await resp.json();
          if (data.access_token) {
            console.log('Got token from server!');
            await AsyncStorage.setItem('startgg_access_token', data.access_token);
            await AsyncStorage.setItem('startgg_refresh_token', data.refresh_token || '');
            await AsyncStorage.setItem('startgg_token_expires', String(Date.now() + (data.expires_in * 1000)));
            setAccessToken(data.access_token);
            // Fetch and store user info
            try {
              const userInfo = await fetchUserInfo(data.access_token);
              console.log('Native auth: fetched user info', userInfo?.player?.gamerTag);
            } catch (e) {
              console.warn('Native auth: failed to fetch user info', e.message);
            }
            setIsAuthenticated(true);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.log('Poll attempt', i + 1, '- waiting...');
        }
      }
      console.warn('Token polling timed out');
      setIsLoading(false);
    } else {
      // Web: use expo-auth-session redirect flow
      console.log('Prompting OAuth login...');
      await promptAsync();
    }
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
    accessToken,
    login,
    logout,
    authService,
  };
}