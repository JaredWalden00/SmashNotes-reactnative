// server.js
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const cors = require('cors');

// Allow requests from local dev, Docker, and LAN (mobile)
app.use(cors({
  origin: true, // Reflect any origin — safe for dev since this is a local proxy
  credentials: false,
}));
app.use(bodyParser.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start.gg OAuth token exchange
app.post('/api/startgg/exchange', async (req, res) => {
  const { code, redirect_uri, code_verifier, client_id } = req.body;

  // Pick the right client credentials based on which OAuth app was used
  const mobileClientId = process.env.EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID;
  const isMobile = client_id === mobileClientId || (redirect_uri && !redirect_uri.includes('localhost'));

  const useClientId = isMobile
    ? (process.env.EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID || process.env.EXPO_PUBLIC_START_GG_CLIENT_ID)
    : process.env.EXPO_PUBLIC_START_GG_CLIENT_ID;
  const useClientSecret = isMobile
    ? (process.env.START_GG_MOBILE_CLIENT_SECRET || process.env.START_GG_CLIENT_SECRET)
    : process.env.START_GG_CLIENT_SECRET;

  try {
    const response = await fetch('https://api.start.gg/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: useClientId,
        client_secret: useClientSecret,
        code,
        redirect_uri,
        code_verifier,
        scope: 'user.identity user.email'
      }),
    });
    const data = await response.json();
    if (data.access_token) {
      res.json(data);
    } else {
      res.status(400).json({ error: data });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Temporary token storage for native OAuth flow
let pendingNativeToken = null;
let pendingNativeTokenExpiry = 0;

// Native OAuth callback — browser redirects here, exchanges code, stores token for native app to pick up
app.get('/auth/native/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  const clientId = process.env.EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID || process.env.EXPO_PUBLIC_START_GG_CLIENT_ID;
  const clientSecret = process.env.START_GG_MOBILE_CLIENT_SECRET || process.env.START_GG_CLIENT_SECRET;
  // Use the Host header to match exactly what the browser used
  const host = req.headers.host || `${req.hostname}:3001`;
  const redirectUri = `http://${host}/auth/native/callback`;

  console.log('[Native OAuth] Code received');
  console.log('[Native OAuth] Client ID:', clientId);
  console.log('[Native OAuth] Redirect URI:', redirectUri);

  try {
    const response = await fetch('https://api.start.gg/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const data = await response.json();
    console.log('[Native OAuth] Token response:', data.access_token ? 'SUCCESS' : JSON.stringify(data));
    if (data.access_token) {
      pendingNativeToken = data;
      pendingNativeTokenExpiry = Date.now() + 120000; // 2 min expiry
      res.send('<html><body style="background:#0F1420;color:#F4F7FF;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column"><h1 style="color:#34D399">Connected!</h1><p>You can close this window and return to SmashNotes.</p></body></html>');
    } else {
      res.status(400).send(`<html><body style="background:#0F1420;color:#F87171;font-family:sans-serif;padding:40px"><h1>Auth Failed</h1><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`);
    }
  } catch (err) {
    res.status(500).send(`<html><body style="background:#0F1420;color:#F87171;font-family:sans-serif;padding:40px"><h1>Error</h1><p>${err.message}</p></body></html>`);
  }
});

// Native app polls this to pick up the token after browser auth
app.get('/auth/native/token', (req, res) => {
  if (pendingNativeToken && Date.now() < pendingNativeTokenExpiry) {
    const token = pendingNativeToken;
    pendingNativeToken = null; // One-time use
    res.json(token);
  } else {
    res.json({ pending: true });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
