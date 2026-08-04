# 🏛️ AccessYourDistrict
**Congressional App Challenge • Civic Inclusion & Crowdsourced Accessibility Platform**

[![Hosted on GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-blue?logo=github)](https://pages.github.com/)
[![Built with Leaflet.js](https://img.shields.io/badge/Map-Leaflet.js%20%2B%20OpenStreetMap-4b5563?logo=openstreetmap)](https://leafletjs.com/)
[![Firebase Realtime Database](https://img.shields.io/badge/Database-Firebase%20Realtime%20DB-ffca28?logo=firebase)](https://firebase.google.com/)

---

## 🌟 Overview
**AccessYourDistrict** is a crowdsourced civic engagement web application built for the **Congressional App Challenge**. It empowers citizens, disability advocates, and local government leaders to report, track, and resolve accessibility barriers in public infrastructure (such as broken wheelchair ramps, blocked sidewalks, missing tactile paving, or defective audible crossing signals).

### 🚀 Key Features
1. **Interactive OpenStreetMap Integration:**
   * Uses **Leaflet.js** and free **OpenStreetMap** tile layers.
   * Leverages the HTML5 **Geolocation API** to automatically center on the user's local congressional district.
2. **Interactive Barrier Reporting:**
   * Clicking **"Report Barrier"** activates a custom crosshair cursor and visual instructional banner.
   * Clicking anywhere on the map opens an accessible modal dialog with pre-populated WGS84 coordinates.
   * Users can categorize barriers (`Broken Ramp`, `Blocked Sidewalk`, `No Tactile Paving`, `Audible Signal`, `Uneven Surface`, or `Other`) and set severity (`High`, `Medium`, `Low`).
3. **Real-Time Database Sync (Firebase & Demo Mode):**
   * Integrates the **Firebase Realtime Database Web SDK (v10 Modular)** using WebSockets (`onValue`) so new reports appear on every visitor's screen in milliseconds.
   * **Out-of-the-box Demo Fallback Mode:** If Firebase credentials haven't been configured yet, the app automatically runs using an in-memory / LocalStorage demo database pre-seeded with realistic sample reports so it can be evaluated immediately!
4. **District Dashboard & Category Filtering:**
   * Responsive sidebar with real-time statistical counters (Total Barriers, High Priority, Resolved).
   * Filter chips to isolate specific accessibility issues.
   * Community confirmation / upvoting system to verify barrier reports.
5. **Zero-Build GitHub Pages Deployment:**
   * Pure HTML5, CSS3, and standard ES Module JavaScript — no Webpack, Vite, or Node.js build step required. Works directly on GitHub Pages!

---

## 📁 Repository Structure
```
COmp/
├── index.html                  # Main Single-Page Application (SPA) HTML5 file
├── css/
│   └── styles.css              # Accessible, high-contrast responsive stylesheet
├── js/
│   ├── firebase-config.js      # Firebase Realtime Database config & init (with Demo Mode fallback)
│   ├── report-service.js       # Repository layer managing Data Structures & CRUD operations
│   ├── map-controller.js       # Leaflet.js map controller (markers, O(1) Map dictionary, popups)
│   ├── ui-controller.js        # DOM events, modal dialogs, statistical dashboard, toast alerts
│   └── app.js                  # Main application orchestrator binding UI, Map, and Services
├── CS_LOGIC_EXPLANATION.md     # Complete CS Logic guide & 3-minute video submission script
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
6. Reload the page — the header badge will switch from **Demo Mode (Local Storage)** to **Connected to Firebase Realtime DB**!

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

For a complete breakdown of your **Data Structures** and **API Calls**, along with a **3-minute presentation script**, see:
👉 [**CS_LOGIC_EXPLANATION.md**](./CS_LOGIC_EXPLANATION.md)

---

## 📄 License
Created for civic inclusion and accessibility advocacy. Built for the Congressional App Challenge.
