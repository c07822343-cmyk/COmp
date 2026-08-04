/**
 * ============================================================================
 * ACCESSYOURDISTRICT - FIREBASE CONFIGURATION & DATABASE INITIALIZATION
 * Congressional App Challenge - Civic Inclusion Platform
 * ============================================================================
 * 
 * ARCHITECTURE & CS LOGIC EXPLANATION:
 * ------------------------------------
 * 1. Why Firebase Realtime Database?
 *    - The Firebase Realtime Database is a cloud-hosted NoSQL database where data
 *      is stored as a JSON tree.
 *    - Unlike traditional request-response REST APIs, it uses WebSockets to
 *      maintain an open real-time connection. When any citizen reports a barrier,
 *      every connected visitor's map updates in milliseconds without refreshing.
 *
 * 2. GitHub Pages Deployment & Build-free ES Modules:
 *    - To ensure compatibility with standard static hosting (GitHub Pages) without
 *      requiring Webpack/Vite bundlers, we import the Firebase v10 Modular SDK
 *      directly from official CDN endpoints using standard ES modules.
 *
 * 3. Fallback Demo Mode (for immediate testing):
 *    - If you have not yet pasted your Firebase credentials below, the app
 *      automatically detects "demo mode" and falls back to a LocalStorage-backed
 *      mock database with sample accessibility reports so you can test immediately!
 * ============================================================================
 */

// Import Firebase App and Realtime Database modules from Google CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  push, 
  set, 
  update, 
  onValue 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

/**
 * ============================================================================
 * STEP 1: INSERT YOUR FIREBASE PROJECT CONFIGURATION HERE
 * ============================================================================
 * To connect your live database:
 * 1. Go to https://console.firebase.google.com/ and create a project.
 * 2. Add a Web App and copy your firebaseConfig object below.
 * 3. In Build > Realtime Database, create a database and set rules to allow
 *    public read/write for crowdsourcing: 
 *    { "rules": { ".read": true, ".write": true } }
 * ============================================================================
 */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "accessyourdistrict-demo.firebaseapp.com",
  databaseURL: "https://accessyourdistrict-demo-default-rtdb.firebaseio.com",
  projectId: "accessyourdistrict-demo",
  storageBucket: "accessyourdistrict-demo.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef1234567890"
};

// Check if user has entered real Firebase API credentials
const isLiveFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY" && 
                                 firebaseConfig.apiKey !== "" && 
                                 !firebaseConfig.apiKey.includes("YOUR_");

let app = null;
let db = null;

if (isLiveFirebaseConfigured) {
  try {
    // Initialize Firebase Web SDK (v10 Modular)
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    console.log("✅ [Firebase SDK] Successfully connected to Firebase Realtime Database.");
  } catch (error) {
    console.error("❌ [Firebase SDK] Error initializing Firebase:", error);
  }
} else {
  console.info(
    "ℹ️ [Demo Mode] Firebase credentials not configured in 'js/firebase-config.js'. " +
    "Running in Demo Mode using LocalStorage & pre-seeded accessibility reports."
  );
}

export {
  firebaseConfig,
  isLiveFirebaseConfigured,
  app,
  db,
  ref,
  push,
  set,
  update,
  onValue
};
