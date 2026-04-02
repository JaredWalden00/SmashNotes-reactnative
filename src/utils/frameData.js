import frameDataJson from "../data/frameData.json";

const BASE_URL = "https://ultimateframedata.com";

// Common move name aliases for fuzzy searching
const MOVE_ALIASES = {
  nair: "Neutral Air",
  fair: "Forward Air",
  bair: "Back Air",
  uair: "Up Air",
  dair: "Down Air",
  ftilt: "Forward Tilt",
  utilt: "Up Tilt",
  dtilt: "Down Tilt",
  fsmash: "Forward Smash",
  usmash: "Up Smash",
  dsmash: "Down Smash",
  "up b": "Up Special",
  "down b": "Down Special",
  "side b": "Side Special",
  "neutral b": "Neutral Special",
  grab: "Grab",
  dash: "Dash Attack",
  "dash attack": "Dash Attack",
  jab: "Jab",
};

/**
 * Get all frame data for a character.
 * @param {string} characterName - App fighter name (e.g., "Bayonetta")
 * @returns {object|null} - { name, slug, categories: [{ category, label, moves }] }
 */
export function getFrameData(characterName) {
  if (!characterName) return null;
  return frameDataJson[characterName] || null;
}

/**
 * Get all character names that have frame data.
 * @returns {string[]}
 */
export function getFrameDataCharacters() {
  return Object.keys(frameDataJson).sort();
}

/**
 * Search moves for a character by name query.
 * @param {string} characterName
 * @param {string} query - e.g., "nair", "jab", "up smash", "forward"
 * @returns {Array} - Matching moves with category info
 */
export function searchMoves(characterName, query) {
  const data = getFrameData(characterName);
  if (!data || !query) return [];

  const q = query.trim().toLowerCase();
  // Expand aliases
  const expanded = MOVE_ALIASES[q] || q;
  const results = [];

  for (const cat of data.categories) {
    for (const move of cat.moves) {
      const name = move.moveName.toLowerCase();
      if (
        name.includes(q) ||
        name.includes(expanded.toLowerCase()) ||
        (move.notes && move.notes.toLowerCase().includes(q))
      ) {
        results.push({ ...move, categoryLabel: cat.label, category: cat.category });
      }
    }
  }

  return results;
}

// Take the first value from slash-separated data like "6.5/5.5/3.5"
function primary(val) {
  if (!val || val === "--") return null;
  return val.split("/")[0].trim();
}

// Check if value is valid (not empty or --)
function valid(val) {
  return val && val !== "--" && val.trim() !== "";
}

/**
 * Format a move as a compact HTML badge for inserting into the rich text editor.
 * Shows only primary (first) values with clear labels.
 */
export function formatMoveAsHtml(move, characterName) {
  const startup = primary(move.startup);
  const damage = primary(move.baseDamage);
  const onShield = primary(move.advantage);

  // Compact: mini-card with colored stat bars like UFD
  const barCss = "display:flex;justify-content:space-between;align-items:center;padding:2px 8px;border-radius:3px;margin-top:2px;font-size:11px;font-weight:700;";

  let bars = "";
  if (startup) bars += `<div style="${barCss}background:#1B4332;color:#34D399;"><span>Startup</span><span>${startup} frame${startup === "1" ? "" : "s"}</span></div>`;
  if (valid(move.activeFrames)) bars += `<div style="${barCss}background:#1A2744;color:#6B9CFF;"><span>Active</span><span>Frame${move.activeFrames.includes("—") || move.activeFrames.includes("-") ? "s" : ""} ${primary(move.activeFrames)}</span></div>`;
  if (valid(move.totalFrames)) {
    const endLag = startup && valid(move.totalFrames) ? parseInt(primary(move.totalFrames)) - parseInt(startup) : null;
    bars += `<div style="${barCss}background:#2D1B4E;color:#A78BFA;"><span>End Lag</span><span>${endLag && endLag > 0 ? endLag + " frames" : primary(move.totalFrames) + " total"}</span></div>`;
  }
  if (onShield) {
    const shieldColor = parseInt(onShield) >= 0 ? "#34D399" : "#F87171";
    const shieldBg = parseInt(onShield) >= 0 ? "#1B4332" : "#4A2930";
    bars += `<div style="${barCss}background:${shieldBg};color:${shieldColor};"><span>On Shield</span><span>${onShield}</span></div>`;
  }
  if (damage) bars += `<div style="${barCss}background:#3B2A10;color:#F59E0B;"><span>Damage</span><span>${damage}%</span></div>`;

  return `<span draggable="true" contenteditable="false" class="fd-badge" style="display:inline-block;background:#141C2B;border:1px solid #2A3449;border-radius:8px;padding:6px 8px;margin:3px 1px;min-width:160px;max-width:220px;cursor:grab;user-select:none;vertical-align:top;line-height:1.3;"><div style="color:#FF6B3D;font-weight:800;font-size:13px;margin-bottom:3px;">${move.moveName}</div>${bars}</span> `;
}

/**
 * Format a move as a detailed HTML block for inserting into notes.
 * Shows all values with clear labeled rows.
 */
export function formatMoveDetailedHtml(move, characterName) {
  const barCss = "display:flex;justify-content:space-between;align-items:center;padding:3px 10px;border-radius:4px;margin-top:3px;font-size:12px;font-weight:700;";
  const header = characterName ? `${characterName} — ${move.moveName}` : move.moveName;
  const startup = primary(move.startup);

  let bars = "";
  if (valid(move.startup)) bars += `<div style="${barCss}background:#1B4332;color:#34D399;"><span>Startup</span><span>${move.startup} frame${move.startup === "1" ? "" : "s"}</span></div>`;
  if (valid(move.activeFrames)) bars += `<div style="${barCss}background:#1A2744;color:#6B9CFF;"><span>Active</span><span>Frames ${move.activeFrames}</span></div>`;
  if (valid(move.totalFrames)) {
    const endLag = startup ? parseInt(primary(move.totalFrames)) - parseInt(startup) : null;
    if (endLag && endLag > 0) {
      bars += `<div style="${barCss}background:#2D1B4E;color:#A78BFA;"><span>End Lag</span><span>${endLag} frames</span></div>`;
    }
    bars += `<div style="${barCss}background:#1B2333;color:#96A3BD;"><span>Total Frames</span><span>${move.totalFrames}</span></div>`;
  }
  if (valid(move.advantage)) {
    const val = primary(move.advantage);
    const color = parseInt(val) >= 0 ? "#34D399" : "#F87171";
    const bg = parseInt(val) >= 0 ? "#1B4332" : "#4A2930";
    bars += `<div style="${barCss}background:${bg};color:${color};"><span>On Shield</span><span>${move.advantage}</span></div>`;
  }
  if (valid(move.baseDamage)) bars += `<div style="${barCss}background:#3B2A10;color:#F59E0B;"><span>Base Damage</span><span>${move.baseDamage}%</span></div>`;
  if (valid(move.landingLag)) bars += `<div style="${barCss}background:#1B2333;color:#96A3BD;"><span>Landing Lag</span><span>${move.landingLag} frames</span></div>`;
  if (valid(move.shieldLag)) bars += `<div style="${barCss}background:#1B2333;color:#96A3BD;"><span>Shield Lag</span><span>${move.shieldLag} frames</span></div>`;
  if (valid(move.shieldStun)) bars += `<div style="${barCss}background:#1B2333;color:#96A3BD;"><span>Shield Stun</span><span>${move.shieldStun} frames</span></div>`;
  if (move.whichHitbox && move.whichHitbox !== "--") bars += `<div style="${barCss}background:#1B2333;color:#C9D4E8;"><span>Hitbox</span><span>${move.whichHitbox}</span></div>`;
  if (move.notes) bars += `<div style="padding:4px 10px;margin-top:4px;border-top:1px solid #2A3449;color:#C9D4E8;font-size:11px;font-style:italic;line-height:1.4;">${move.notes}</div>`;

  return `<div draggable="true" contenteditable="false" class="fd-badge" style="display:inline-block;background:#141C2B;border:1px solid #2A3449;border-radius:10px;padding:8px;margin:4px 0;min-width:240px;max-width:360px;cursor:grab;user-select:none;"><div style="color:#FF6B3D;font-weight:800;font-size:14px;margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid #2A3449;">${header}</div>${bars}</div><br>`;
}

/**
 * Get the ultimateframedata.com URL for a character.
 */
export function getUfdUrl(characterName) {
  const data = getFrameData(characterName);
  if (!data) return null;
  return `${BASE_URL}/${data.slug}`;
}
