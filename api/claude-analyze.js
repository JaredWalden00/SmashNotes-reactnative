export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType, context } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'No image provided' });
  }

  // Check size — reject if base64 is over 5MB
  if (imageBase64.length > 5 * 1024 * 1024 * 1.37) {
    return res.status(413).json({ error: 'Image too large. Please use a smaller screenshot.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });
  }

  // Build Smash-specific prompt
  let prompt = `You are analyzing a Super Smash Bros. Ultimate game screenshot. Provide a detailed analysis in the following format:

**Game State:**
- Read and report the exact damage percentages for each player (P1 on left, P2 on right)
- Report stocks remaining for each player
- Identify the characters being played if visible
- Identify the stage if recognizable

**Positioning:**
- Where is each player on stage? (center, ledge, offstage, platform, above)
- Who has stage control?
- What's the current state? (neutral, advantage, disadvantage, edgeguard, recovery, combo)

**Tactical Notes:**
- What options does each player have from this position?
- Is anyone in kill percent range?
- Any notable observations about the game state?

Keep it concise — use short bullet points. Format with HTML bold tags for key terms. Keep total response under 200 words.`;

  if (context?.characterPlayed) {
    prompt += `\n\nThe user plays ${context.characterPlayed}.`;
  }
  if (context?.opponent) {
    prompt += ` Their opponent plays ${context.opponent}.`;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/png',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Claude API error:', data.error);
      return res.status(400).json({ error: data.error.message || 'Claude API error' });
    }

    const analysisText = data.content?.[0]?.text || 'No analysis generated';
    return res.status(200).json({ analysis: analysisText });
  } catch (err) {
    console.error('Claude API request failed:', err);
    return res.status(500).json({ error: err.message || 'Failed to analyze image' });
  }
}
