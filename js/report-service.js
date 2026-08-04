/**
 * ============================================================================
 * ACCESSYOURDISTRICT - REPORT SERVICE (DATA LAYER / REPOSITORY PATTERN)
 * Congressional App Challenge - Civic Inclusion Platform
 * ============================================================================
 *
 * CS LOGIC & DATA STRUCTURE EXPLANATION:
 * --------------------------------------
 * 1. Data Structure - AccessibilityReport Schema:
 *    Every reported accessibility barrier is modeled as a standardized JSON
 *    object with well-typed fields:
 *    {
 *      "id": "rep_1722788400000",       // Unique string identifier
 *      "title": "NE Corner Curb Cut",   // Short title / landmark
 *      "category": "RAMP",              // Enum: 'RAMP'|'SIDEWALK'|'TACTILE'|'SIGNAL'|'SURFACE'|'OTHER'
 *      "lat": 38.8895,                  // Floating-point latitude
 *      "lng": -77.0089,                 // Floating-point longitude
 *      "description": "Curb ramp cracked and flooded after rain...", // Details
 *      "severity": "HIGH",              // Enum: 'HIGH'|'MEDIUM'|'LOW'
 *      "status": "OPEN",                // Enum: 'OPEN'|'RESOLVED'
 *      "timestamp": 1722788400000,      // UTC Epoch milliseconds (integer)
 *      "upvotes": 3                     // Counter for community verification
 *    }
 *
 * 2. API Calls & Real-Time Sync Logic:
 *    - In Firebase mode: Uses `onValue(ref(db, 'reports'), callback)` which
 *      opens a persistent WebSocket. Whenever any user pushes a report, Firebase
 *      broadcasts the updated JSON tree to all subscribed clients.
 *    - In Demo / LocalStorage mode: Uses an in-memory event emitter pattern
 *      backed by window.localStorage so students can test offline or before
 *      configuring live Firebase credentials.
 * ============================================================================
 */

import { 
  isLiveFirebaseConfigured, 
  db, 
  ref, 
  push, 
  set, 
  update, 
  onValue 
} from "./firebase-config.js";

// Key used for LocalStorage demo database fallback
const LOCAL_STORAGE_KEY = "access_your_district_reports_v1";

// Internal list of active subscriber callbacks
const subscribers = new Set();

/**
 * Seed sample accessibility barriers around a representative congressional
 * district (Capitol Hill / Washington D.C. area) for immediate evaluation.
 * @returns {Array<Object>} Array of sample AccessibilityReport objects
 */
function getInitialSampleReports() {
  const now = Date.now();
  return [
    {
      id: "demo_1",
      title: "Broken Wheelchair Ramp at Library Entrance",
      category: "RAMP",
      lat: 38.8885,
      lng: -77.0047,
      description: "The concrete curb ramp on Independence Ave SE has a severe 3-inch lip and crack that prevents wheelchair and motorized scooter passage.",
      severity: "HIGH",
      status: "OPEN",
      timestamp: now - 86400000 * 2, // 2 days ago
      upvotes: 14
    },
    {
      id: "demo_2",
      title: "Missing Tactile Paving at Crosswalk",
      category: "TACTILE",
      lat: 38.8912,
      lng: -77.0091,
      description: "Truncated dome warning tiles are missing on the northeast corner of 1st St & Constitution Ave NW. Dangerous for visually impaired pedestrians.",
      severity: "HIGH",
      status: "OPEN",
      timestamp: now - 86400000 * 5, // 5 days ago
      upvotes: 8
    },
    {
      id: "demo_3",
      title: "Sidewalk Obstructed by Utility Excavation",
      category: "SIDEWALK",
      lat: 38.8863,
      lng: -77.0118,
      description: "Construction fencing blocks 90% of the sidewalk walkway on C St SW without a safe accessible detour sign posted.",
      severity: "MEDIUM",
      status: "OPEN",
      timestamp: now - 86400000 * 1, // 1 day ago
      upvotes: 5
    },
    {
      id: "demo_4",
      title: "Inaudible Pedestrian Crossing Signal",
      category: "SIGNAL",
      lat: 38.8928,
      lng: -77.0065,
      description: "The audible chirping locator tone for blind crossing is completely non-functional at the intersection near the Senate office building.",
      severity: "MEDIUM",
      status: "OPEN",
      timestamp: now - 86400000 * 3, // 3 days ago
      upvotes: 6
    },
    {
      id: "demo_5",
      title: "Repaired Sidewalk Pothole & Root Buckling",
      category: "SURFACE",
      lat: 38.8871,
      lng: -77.0023,
      description: "Tree roots previously raised sidewalk pavers by 4 inches. Department of Public Works smoothed the surface and installed a safe slope.",
      severity: "LOW",
      status: "RESOLVED",
      timestamp: now - 86400000 * 10, // 10 days ago
      upvotes: 19
    }
  ];
}

/**
 * Load reports from LocalStorage or initialize with sample demo data.
 * @returns {Array<Object>}
 */
function getLocalReports() {
  try {
    const rawData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!rawData) {
      const samples = getInitialSampleReports();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(samples));
      return samples;
    }
    return JSON.parse(rawData);
  } catch (err) {
    console.warn("⚠️ Error reading LocalStorage, falling back to memory:", err);
    return getInitialSampleReports();
  }
}

/**
 * Save reports array to LocalStorage and notify all subscribers.
 * @param {Array<Object>} reports
 */
function saveLocalReports(reports) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reports));
  } catch (err) {
    console.warn("⚠️ Error writing LocalStorage:", err);
  }
  notifySubscribers(reports);
}

/**
 * Notify all registered listener callbacks with the latest reports list.
 * @param {Array<Object>} reports
 */
function notifySubscribers(reports) {
  // Always sort reports by timestamp descending (newest first)
  const sorted = [...reports].sort((a, b) => b.timestamp - a.timestamp);
  for (const callback of subscribers) {
    try {
      callback(sorted);
    } catch (e) {
      console.error("Error in subscriber callback:", e);
    }
  }
}

/**
 * ============================================================================
 * PUBLIC SERVICE METHODS (API LAYER)
 * ============================================================================
 */

/**
 * Subscribe to real-time report updates from Firebase Realtime Database
 * (or local demo database).
 *
 * @param {Function} callback - Function called with an array of AccessibilityReport
 * @returns {Function} Unsubscribe function
 */
export function subscribeToReports(callback) {
  subscribers.add(callback);

  if (isLiveFirebaseConfigured && db) {
    // REALTIME DATABASE WEB SDK API CALL:
    // Listen to changes at the '/reports' node in Firebase
    const reportsRef = ref(db, "reports");
    
    const unsubscribeFirebase = onValue(
      reportsRef,
      (snapshot) => {
        const data = snapshot.val();
        const reportsArray = [];

        if (data) {
          // Convert Firebase dictionary { "key1": {...}, "key2": {...} } to Array
          Object.keys(data).forEach((key) => {
            reportsArray.push({
              id: key,
              ...data[key]
            });
          });
        }

        notifySubscribers(reportsArray);
      },
      (error) => {
        console.error("❌ [Firebase Error] Failed to read reports:", error);
      }
    );

    // Return cleanup function
    return () => {
      subscribers.delete(callback);
      unsubscribeFirebase();
    };
  } else {
    // DEMO MODE (LOCALSTORAGE FALLBACK)
    const initialReports = getLocalReports();
    notifySubscribers(initialReports);

    return () => {
      subscribers.delete(callback);
    };
  }
}

/**
 * Submit a new accessibility barrier report.
 *
 * @param {Object} formData
 * @param {string} formData.title - Location title / landmark
 * @param {string} formData.category - Category code ('RAMP', 'SIDEWALK', etc.)
 * @param {number} formData.lat - Latitude
 * @param {number} formData.lng - Longitude
 * @param {string} formData.description - Description of barrier
 * @param {string} formData.severity - Severity ('HIGH'|'MEDIUM'|'LOW')
 * @returns {Promise<Object>} The newly created report object
 */
export async function addReport(formData) {
  const newReport = {
    title: formData.title.trim(),
    category: formData.category,
    lat: Number(formData.lat),
    lng: Number(formData.lng),
    description: formData.description.trim(),
    severity: formData.severity || "MEDIUM",
    status: "OPEN",
    timestamp: Date.now(),
    upvotes: 1
  };

  if (isLiveFirebaseConfigured && db) {
    // REAL-TIME DATABASE API CALL:
    // push() generates a unique chronological key (e.g. -N1a2B3c4D5e6F7g8H9)
    const reportsRef = ref(db, "reports");
    const newRef = await push(reportsRef, newReport);
    return {
      id: newRef.key,
      ...newReport
    };
  } else {
    // DEMO MODE: Create ID and persist to LocalStorage
    const currentReports = getLocalReports();
    const created = {
      id: "rep_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      ...newReport
    };
    currentReports.push(created);
    saveLocalReports(currentReports);
    return created;
  }
}

/**
 * Upvote / confirm an accessibility barrier report.
 *
 * @param {string} reportId
 * @param {number} currentUpvotes
 * @returns {Promise<number>} New upvote count
 */
export async function upvoteReport(reportId, currentUpvotes = 0) {
  const newCount = currentUpvotes + 1;

  if (isLiveFirebaseConfigured && db) {
    // Update specific child node in Firebase Realtime Database
    const reportRef = ref(db, `reports/${reportId}`);
    await update(reportRef, { upvotes: newCount });
    return newCount;
  } else {
    const currentReports = getLocalReports();
    const target = currentReports.find((r) => r.id === reportId);
    if (target) {
      target.upvotes = (target.upvotes || 0) + 1;
      saveLocalReports(currentReports);
      return target.upvotes;
    }
    return newCount;
  }
}

/**
 * Mark a barrier report as RESOLVED.
 *
 * @param {string} reportId
 * @returns {Promise<boolean>}
 */
export async function resolveReport(reportId) {
  if (isLiveFirebaseConfigured && db) {
    const reportRef = ref(db, `reports/${reportId}`);
    await update(reportRef, { status: "RESOLVED" });
    return true;
  } else {
    const currentReports = getLocalReports();
    const target = currentReports.find((r) => r.id === reportId);
    if (target) {
      target.status = "RESOLVED";
      saveLocalReports(currentReports);
      return true;
    }
    return false;
  }
}

/**
 * Reset local demo data back to default sample reports (useful for demos).
 */
export function resetDemoData() {
  const samples = getInitialSampleReports();
  saveLocalReports(samples);
  console.log("🔄 Demo data has been reset to original 5 sample reports.");
}
