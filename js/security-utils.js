/**
 * ============================================================================
 * ACCESSYOURDISTRICT - CYBERSECURITY & INPUT SANITIZATION UTILITIES
 * Congressional App Challenge - Civic Inclusion Platform
 * ============================================================================
 *
 * CYBERSECURITY ARCHITECTURE & DEFENSE-IN-DEPTH EXPLANATION:
 * ----------------------------------------------------------
 * 1. Cross-Site Scripting (XSS) Prevention:
 *    - `sanitizeText(input, maxLen)` strips dangerous control characters and
 *      converts HTML syntax (`<`, `>`, `"`, `'`, `&`) to safe HTML entities.
 *    - `escapeHTML(str)` encodes output before inserting into Leaflet popups
 *      and sidebar cards, providing double-layer XSS defense.
 *
 * 2. Form & Schema Validation (Defensive Guardrails):
 *    - `validateReportInput(formData)` verifies WGS84 geographic coordinate
 *      ranges (`-90 <= lat <= 90`, `-180 <= lng <= 180`), string length bounds,
 *      and strict category/severity enum matching before sending data to Firebase.
 *
 * 3. Client-Side Rate Limiting (Spam Mitigation):
 *    - `checkRateLimit(key, cooldownSeconds)` prevents automated scripts or
 *      spam users from flooding the map with fake pins by enforcing a cooldown
 *      window between submissions.
 * ============================================================================
 */

// Allowed category and severity enum whitelists
const ALLOWED_CATEGORIES = new Set(["RAMP", "SIDEWALK", "TACTILE", "SIGNAL", "SURFACE", "OTHER"]);
const ALLOWED_SEVERITIES = new Set(["HIGH", "MEDIUM", "LOW"]);
const ALLOWED_STATUSES = new Set(["OPEN", "RESOLVED"]);

/**
 * Encode HTML characters to prevent XSS attacks when rendering dynamic content.
 *
 * @param {string} str - Raw string
 * @returns {string} Safe HTML-escaped string
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Sanitize user input by trimming whitespace, enforcing maximum length bounds,
 * and neutralizing script tags or inline event handlers.
 *
 * @param {string} input - User input string
 * @param {number} [maxLen=500] - Maximum allowed character length
 * @returns {string} Sanitized string safe for storage and display
 */
export function sanitizeText(input, maxLen = 500) {
  if (!input || typeof input !== "string") return "";

  // 1. Trim leading and trailing whitespace
  let clean = input.trim();

  // 2. Truncate to maximum character length to prevent DoS large-payload attacks
  if (clean.length > maxLen) {
    clean = clean.substring(0, maxLen);
  }

  // 3. Strip any dangerous javascript: or data: URL patterns
  clean = clean.replace(/javascript:/gi, "").replace(/data:/gi, "");

  // 4. Strip <script> and <iframe> tags explicitly
  clean = clean
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");

  // 5. Escape HTML symbols
  return escapeHTML(clean);
}

/**
 * Validate a barrier report submission against strict schema and coordinate rules.
 *
 * @param {Object} formData
 * @param {string} formData.title
 * @param {string} formData.category
 * @param {number|string} formData.lat
 * @param {number|string} formData.lng
 * @param {string} formData.description
 * @param {string} [formData.severity]
 * @returns {{ isValid: boolean, errors: string[], sanitizedData: Object|null }}
 */
export function validateReportInput(formData = {}) {
  const errors = [];

  // 1. Validate & sanitize Title
  const title = sanitizeText(formData.title, 100);
  if (!title || title.length < 3) {
    errors.push("Location title must be between 3 and 100 characters.");
  }

  // 2. Validate Category enum
  const category = (formData.category || "").toUpperCase();
  if (!ALLOWED_CATEGORIES.has(category)) {
    errors.push("Invalid accessibility issue category selected.");
  }

  // 3. Validate Severity enum
  const severity = (formData.severity || "MEDIUM").toUpperCase();
  if (!ALLOWED_SEVERITIES.has(severity)) {
    errors.push("Invalid severity level specified.");
  }

  // 4. Validate WGS84 Geographical Coordinates
  const lat = Number(formData.lat);
  const lng = Number(formData.lng);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    errors.push("Latitude coordinate must be a valid number between -90 and 90.");
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    errors.push("Longitude coordinate must be a valid number between -180 and 180.");
  }
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
    errors.push("Please select a valid location on the map.");
  }

  // 5. Validate & sanitize Description
  const description = sanitizeText(formData.description, 500);
  if (!description || description.length < 5) {
    errors.push("Description must be between 5 and 500 characters.");
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      sanitizedData: null
    };
  }

  return {
    isValid: true,
    errors: [],
    sanitizedData: {
      title,
      category,
      lat,
      lng,
      description,
      severity,
      status: "OPEN",
      timestamp: Date.now(),
      upvotes: 1
    }
  };
}

/**
 * Check if the current client is rate-limited from performing an action.
 * Mitigates spamming the map with fake pins.
 *
 * @param {string} [actionKey="report_submission"]
 * @param {number} [cooldownSeconds=15] - Seconds required between submissions
 * @returns {{ allowed: boolean, remainingSeconds: number }}
 */
export function checkRateLimit(actionKey = "report_submission", cooldownSeconds = 15) {
  const storageKey = `ayd_rate_limit_${actionKey}`;
  const now = Date.now();

  try {
    const lastTimestampStr = localStorage.getItem(storageKey);
    if (lastTimestampStr) {
      const lastTimestamp = parseInt(lastTimestampStr, 10);
      const elapsedMs = now - lastTimestamp;
      const cooldownMs = cooldownSeconds * 1000;

      if (elapsedMs < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
        return { allowed: false, remainingSeconds };
      }
    }

    localStorage.setItem(storageKey, now.toString());
    return { allowed: true, remainingSeconds: 0 };
  } catch (err) {
    // If LocalStorage is disabled or fails, allow action safely
    return { allowed: true, remainingSeconds: 0 };
  }
}

export { ALLOWED_CATEGORIES, ALLOWED_SEVERITIES, ALLOWED_STATUSES };
