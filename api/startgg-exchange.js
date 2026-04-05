export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, redirect_uri, code_verifier, client_id } = req.body;

  const secrets = {
    '442': process.env.START_GG_CLIENT_SECRET,
    '450': process.env.START_GG_MOBILE_CLIENT_SECRET,
    '455': process.env.START_GG_PROD_CLIENT_SECRET,
  };
  const clientSecret = secrets[client_id] || process.env.START_GG_PROD_CLIENT_SECRET;

  try {
    const response = await fetch('https://api.start.gg/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id,
        client_secret: clientSecret,
        code,
        redirect_uri,
        code_verifier,
      }),
    });
    const data = await response.json();
    if (data.access_token) {
      return res.status(200).json(data);
    }
    return res.status(400).json({ error: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
