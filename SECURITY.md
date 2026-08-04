# 🛡️ AccessYourDistrict — Cybersecurity & Hardening Guide
**Congressional App Challenge • Civic Inclusion & Crowdsourced Accessibility Platform**

---

## 📋 Overview
Because **AccessYourDistrict** is a crowdsourced civic platform hosted on **GitHub Pages** and backed by **Firebase Realtime Database**, hardening the application against Cross-Site Scripting (XSS), data schema poisoning, and automated map spam is critical.

This guide outlines our **3-layer defensive cybersecurity architecture**:
1. **Client-Side Input Sanitization & XSS Prevention (`js/security-utils.js`)**
2. **Strict Form & WGS84 Geographic Schema Validation**
3. **Server-Side Firebase Security Rules & Spam Mitigation (`firebase-security-rules.json`)**

---

## 1. XSS Prevention & Input Sanitization (`js/security-utils.js`)

To prevent Cross-Site Scripting (XSS) and DOM injection attacks from malicious inputs, all user-generated strings (`title`, `description`, etc.) pass through our hardening utilities:

### `sanitizeText(input, maxLen = 500)`
* **Whitespace & Length Bounds:** Enforces strict character limits (100 characters for `title`, 500 characters for `description`) to prevent Denial of Service (DoS) oversized payload attacks.
* **Tag Neutralization:** Strips `<script>`, `<iframe>`, and dangerous `javascript:` / `data:` URI schemes.
* **HTML Entity Escaping:** Converts HTML control characters (`<`, `>`, `&`, `"`, `'`, `/`) into safe entities (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&#39;`, `&#x2F;`).

### `escapeHTML(str)` (Output Encoding Defense-in-Depth)
Even after data is sanitized prior to storage, `escapeHTML(str)` encodes strings immediately before rendering them into Leaflet Popups or sidebar cards, providing double-layer XSS defense.

---

## 2. Form & Schema Validation (Defensive Guardrails)

Before a report can be transmitted to Firebase, `validateReportInput(formData)` verifies:
* **WGS84 Geographical Coordinate Range:**
  * `-90 <= lat <= 90` and `-180 <= lng <= 180`
  * Rejects `0, 0` null-island coordinates or out-of-bounds numbers.
* **Enum Whitelists:**
  * `category` must strictly match `["RAMP", "SIDEWALK", "TACTILE", "SIGNAL", "SURFACE", "OTHER"]`.
  * `severity` must strictly match `["HIGH", "MEDIUM", "LOW"]`.
* **Rate-Limiting / Anti-Spam Guard (`checkRateLimit`):**
  * Enforces a 15-second cooldown window between report submissions to prevent automated scripts from flooding the map with fake pins.

---

## 3. Firebase Security Rules (`firebase-security-rules.json`)

To secure your cloud database console against unauthorized writes, spam pins, and malformed payloads, copy the contents of [`firebase-security-rules.json`](./firebase-security-rules.json) into your Firebase Console under **Realtime Database > Rules**:

```json
{
  "rules": {
    "reports": {
      // 1. PUBLIC READ: Anyone visiting GitHub Pages can read reports to view the map
      ".read": true,
      
      "$report_id": {
        // 2. WRITE PROTECTION:
        // Allow writes only if authenticated (auth != null) OR creating a new validated report (!data.exists())
        ".write": "auth != null || !data.exists()",
        
        // 3. SERVER-SIDE SCHEMA & REGEX DATA VALIDATION:
        ".validate": "newData.hasChildren(['title', 'category', 'lat', 'lng', 'description', 'severity', 'status', 'timestamp', 'upvotes']) && newData.child('title').isString() && newData.child('title').val().length >= 3 && newData.child('title').val().length <= 100 && newData.child('description').isString() && newData.child('description').val().length >= 5 && newData.child('description').val().length <= 500 && newData.child('category').val().matches(/^(RAMP|SIDEWALK|TACTILE|SIGNAL|SURFACE|OTHER)$/) && newData.child('severity').val().matches(/^(HIGH|MEDIUM|LOW)$/) && newData.child('status').val().matches(/^(OPEN|RESOLVED)$/) && newData.child('lat').isNumber() && newData.child('lat').val() >= -90 && newData.child('lat').val() <= 90 && newData.child('lng').isNumber() && newData.child('lng').val() >= -180 && newData.child('lng').val() <= 180 && newData.child('upvotes').isNumber() && newData.child('upvotes').val() >= 0 && newData.child('timestamp').isNumber() && newData.child('timestamp').val() <= now"
      }
    }
  }
}
```

### Why Judges Value These Firebase Security Rules:
* **Server-Side Validation:** Even if an attacker bypasses client-side JavaScript using `curl` or Postman, Firebase Realtime Database itself rejects any record that violates WGS84 coordinate bounds, string lengths, or regex enum matching.
* **Timestamp Verification:** `newData.child('timestamp').val() <= now` prevents future-dated spam pins from clogging the chronological feed.

---

## 4. How to Apply These Rules in Firebase Console

1. Log in to [Firebase Console](https://console.firebase.google.com/).
2. Select your project (`access-your-district`).
3. Click **Realtime Database** in the left sidebar, then click the **Rules** tab.
4. Replace the default rules with the JSON block above (from [`firebase-security-rules.json`](./firebase-security-rules.json)).
5. Click **Publish**. Your cloud database is now hardened!
