// server.js
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const cors = require('cors');

// Allow requests from both local dev and Docker containers
app.use(cors({
  origin: [
    'http://localhost:8081',
    'http://localhost:19006',
    'http://127.0.0.1:8081',
    'http://smashnotes-expo-web:8081',
  ],
  credentials: false,
}));
app.use(bodyParser.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start.gg OAuth token exchange
app.post('/api/startgg/exchange', async (req, res) => {
  const { code, redirect_uri, code_verifier } = req.body;
  try {
    const response = await fetch('https://api.start.gg/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.EXPO_PUBLIC_START_GG_CLIENT_ID,
        client_secret: process.env.START_GG_CLIENT_SECRET,
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
