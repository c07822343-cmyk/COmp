# 🏛️ AccessYourDistrict
**Congressional App Challenge • Civic Inclusion & Crowdsourced Accessibility Platform**

[![Hosted on GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-blue?logo=github)](https://pages.github.com/)
[![Built with Leaflet.js](https://img.shields.io/badge/Map-Leaflet.js%20%2B%20OpenStreetMap-4b5563?logo=openstreetmap)](https://leafletjs.com/)
[![Firebase Realtime Database](https://img.shields.io/badge/Database-Firebase%20Realtime%20DB-ffca28?logo=firebase)](https://firebase.google.com/)
[![WCAG AAA Accessibility](https://img.shields.io/badge/Accessibility-WCAG%20AAA%20Compliant-00ffff?logo=w3c)](https://www.w3.org/WAI/standards-guidelines/wcag/)

---

## 🌟 Overview
**AccessYourDistrict** is a crowdsourced civic engagement web application built for the **Congressional App Challenge**. It empowers residents, disability advocates, and local government leaders to report, track, and resolve accessibility barriers in public infrastructure (such as broken wheelchair ramps, blocked sidewalks, missing tactile paving, or defective audible crossing signals).

### 🏆 Why Judges Will Love This Implementation

1. **Accessibility First (WCAG AAA & ADA Compliant Design):**
   * **Ultra High-Contrast Dark Mode (`🌗 High Contrast`):** Inspired by accessibility winners like *SoniSight*, users can switch between a clean high-contrast civic theme and an Ultra High-Contrast Dark Theme (`#000000` background, `#ffff00` headings, and `#00ffff` links) exceeding WCAG AAA contrast ratios (> 7:1).
   * **Dynamic Text Scaler (`A`, `A+`, `A++`):** Built-in accessibility toolbar allows visually impaired visitors to scale root text sizing by up to **135%** on the fly.
   * **WCAG 2.2 Touch Targets & Keyboard Focus:** Minimum 44–48px touch targets for all buttons and crisp 3px visible focus outlines for screen readers and keyboard navigation.

2. **Responsive Dashboard & Mobile Portability:**
   * **Desktop & Tablet:** Executive multi-column dashboard grid with a persistent left sidebar (`410px`) for statistical overview, multi-select filtering, and interactive report feed alongside a full-viewport Leaflet map.
   * **Mobile View Switcher (< 768px):** A dedicated mobile tab bar (`🗺️ Map View` vs `📊 Dashboard & Filters`) allows mobile visitors to toggle between a 100% full-screen map and a 100% full-screen dashboard without squishing the UI.

3. **Advanced Multi-Select Filtering & Real-Time Search Engine:**
   * **Multi-Select Category Checklist:** Toggle individual barrier categories (`[✔] Broken Ramp`, `[✔] Blocked Sidewalk`, `[✔] No Tactile Paving`, etc.) or click **Select All / Reset**.
   * **Urgency / Severity Filter:** Filter reports by urgency level (`High Priority`, `Medium`, `Low`, or `Resolved Improvements`).
   * **Real-Time Text Search:** Instant substring search across location title, landmark, or barrier description.

4. **Congressional District Portal Integration (Civic Advocacy):**
   * Features an official **Congressional District Portal banner** in the footer connecting residents directly to their U.S. Representative (`https://www.house.gov/representatives/find-your-representative`) and official legislation (`https://www.congress.gov`).

5. **Real-Time Database Sync (Firebase & Out-of-the-Box Demo Mode):**
   * Integrates the **Firebase Realtime Database Web SDK (v10 Modular)** via WebSockets (`onValue`) so new reports broadcast to all visitors in milliseconds.
   * **Demo Fallback Mode:** Works immediately out of the box using LocalStorage and 5 pre-seeded Capitol Hill sample reports even before configuring your own Firebase credentials!

---

## 📁 Repository Structure
```
COmp/
├── index.html                  # Main Single-Page Application (SPA) HTML5 file
├── css/
│   └── styles.css              # WCAG AAA accessible, responsive stylesheet with text scaler
├── js/
│   ├── firebase-config.js      # Firebase Realtime Database config & init (with Demo Mode fallback)
│   ├── report-service.js       # Repository layer managing Data Structures & CRUD operations
│   ├── map-controller.js       # Leaflet.js map controller (markers, O(1) Map dictionary, popups)
│   ├── ui-controller.js        # DOM events, A11Y toolbar, multi-select filters, mobile switcher
│   └── app.js                  # Main application orchestrator binding UI, Map, and Services
├── CS_LOGIC_EXPLANATION.md     # Complete CS Logic guide, UX standards & 3-minute video script
└── README.md                   # Project documentation (this file)
```

---

## 🛠️ How to Run & Test Locally

You can test the application locally in seconds without any build tools:

1. **Using Python 3 Static Server:**
   ```bash
   python3 -m http.server 8000
   ```
   Open `http://localhost:8000` in your web browser.

2. **Using Node.js / NPX:**
   ```bash
   npx serve .
   ```

---

## ☁️ Connecting Your Live Firebase Realtime Database

1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Navigate to **Build > Realtime Database** and click **Create Database**.
3. Set your Realtime Database security rules:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
4. Go to **Project Settings > General > Your apps > Web app** and copy your `firebaseConfig`.
5. Open `js/firebase-config.js` and replace the placeholder `firebaseConfig` object with your live credentials:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_ACTUAL_API_KEY",
     authDomain: "your-project.firebaseapp.com",
     databaseURL: "https://your-project-default-rtdb.firebaseio.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
6. Reload the page — the header badge will switch from **Demo Mode (Local Storage)** to **Firebase Connected**!

---

## 🌐 Deploying to GitHub Pages

1. Commit and push this repository to your GitHub account:
   ```bash
   git add .
   git commit -m "Deploy AccessYourDistrict SPA"
   git push origin main
   ```
2. On GitHub, go to your repository **Settings > Pages**.
3. Under **Build and deployment > Source**, select **Deploy from a branch**.
4. Choose the `main` branch and `/ (root)` folder, then save.
5. Your live app will be published at `https://<your-username>.github.io/<repository-name>/`.

---

## 🎥 Congressional App Challenge Video Submission Guide

For a complete breakdown of your **Data Structures**, **API Calls**, **Accessibility Standards**, and a **3-minute presentation script**, see:
👉 [**CS_LOGIC_EXPLANATION.md**](./CS_LOGIC_EXPLANATION.md)

---

## 📄 License
Created for civic inclusion and accessibility advocacy. Built for the Congressional App Challenge.
