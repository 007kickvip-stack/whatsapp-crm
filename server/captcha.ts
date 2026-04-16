import crypto from "crypto";

// In-memory captcha store: token -> { code, expiresAt }
const captchaStore = new Map<string, { code: string; expiresAt: number }>();

// Cleanup expired captchas periodically
setInterval(() => {
  const now = Date.now();
  captchaStore.forEach((data, token) => {
    if (data.expiresAt < now) captchaStore.delete(token);
  });
}, 60_000);

const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars: I,O,0,1
const CAPTCHA_LENGTH = 4;
const CAPTCHA_TTL = 5 * 60 * 1000; // 5 minutes

function randomChar(): string {
  return CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
}

function generateCode(): string {
  return Array.from({ length: CAPTCHA_LENGTH }, randomChar).join("");
}

/**
 * Generate a captcha SVG image with noise lines and distorted text
 * Returns { token, svg } where svg is the SVG string
 */
export function generateCaptcha(): { token: string; svg: string; code: string } {
  const code = generateCode();
  const token = crypto.randomBytes(16).toString("hex");

  // Store captcha
  captchaStore.set(token, { code: code.toUpperCase(), expiresAt: Date.now() + CAPTCHA_TTL });

  // Generate SVG captcha
  const width = 160;
  const height = 50;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  // Background
  svg += `<rect width="${width}" height="${height}" fill="#f0fdf4" rx="6"/>`;

  // Noise lines
  for (let i = 0; i < 6; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    const colors = ["#86efac", "#a7f3d0", "#d1d5db", "#fde68a", "#c4b5fd", "#fca5a5"];
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors[i % colors.length]}" stroke-width="${1 + Math.random() * 2}" opacity="0.6"/>`;
  }

  // Noise dots
  for (let i = 0; i < 30; i++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const r = 1 + Math.random() * 2;
    const colors = ["#86efac", "#d1d5db", "#fde68a", "#c4b5fd"];
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${colors[i % colors.length]}" opacity="0.5"/>`;
  }

  // Text characters with individual transforms
  const charWidth = width / (CAPTCHA_LENGTH + 1);
  for (let i = 0; i < code.length; i++) {
    const x = charWidth * (i + 0.7);
    const y = height / 2 + 8;
    const rotation = -15 + Math.random() * 30;
    const fontSize = 24 + Math.random() * 8;
    const textColors = ["#059669", "#047857", "#065f46", "#0d9488", "#0f766e"];
    const color = textColors[Math.floor(Math.random() * textColors.length)];
    svg += `<text x="${x}" y="${y}" font-family="monospace, Arial" font-size="${fontSize}" font-weight="bold" fill="${color}" text-anchor="middle" transform="rotate(${rotation},${x},${y})">${code[i]}</text>`;
  }

  // Bezier curve noise
  for (let i = 0; i < 2; i++) {
    const startX = Math.random() * 20;
    const startY = 10 + Math.random() * 30;
    const cp1X = width * 0.3 + Math.random() * 20;
    const cp1Y = Math.random() * height;
    const cp2X = width * 0.6 + Math.random() * 20;
    const cp2Y = Math.random() * height;
    const endX = width - Math.random() * 20;
    const endY = 10 + Math.random() * 30;
    svg += `<path d="M${startX},${startY} C${cp1X},${cp1Y} ${cp2X},${cp2Y} ${endX},${endY}" fill="none" stroke="#10b981" stroke-width="1.5" opacity="0.3"/>`;
  }

  svg += "</svg>";

  return { token, svg, code };
}

/**
 * Verify a captcha code against a token
 * Returns true if valid, false otherwise
 * The captcha is consumed (deleted) after verification regardless of result
 */
export function verifyCaptcha(token: string, code: string): boolean {
  const data = captchaStore.get(token);
  if (!data) return false;

  // Always delete after attempt (one-time use)
  captchaStore.delete(token);

  if (data.expiresAt < Date.now()) return false;

  return data.code === code.toUpperCase();
}

/**
 * Get the number of stored captchas (for testing/monitoring)
 */
export function getCaptchaStoreSize(): number {
  return captchaStore.size;
}
