/**
 * ============================================================================
 * ACCESSYOURDISTRICT - REPORT, CIVIC DIRECTORY & OFFLINE QUEUE SERVICE
 * Congressional App Challenge - Civic Inclusion Platform
 * ============================================================================
 *
 * CS LOGIC, DATA STRUCTURES & OFFLINE FIELD ARCHITECTURE:
 * -------------------------------------------------------
 * 1. Offline Field Resiliency (`ayd_offline_queue`):
 *    - When a constituent or field worker submits a barrier report in an area
 *      with zero cellular service (`!navigator.onLine`), `addReport()` stores
 *      the validated payload into a LocalStorage offline queue (`ayd_offline_queue`).
 *    - When network connectivity is restored (`online` event), `syncOfflineQueue()`
 *      automatically flushes queued reports to Firebase Realtime Database.
 *
 * 2. Advanced Programming Skill - CSV Data Export Engine (`exportReportsToCSV`):
 *    - Converts JSON trees into standardized RFC 4180 CSV files with proper
 *      string escaping, MIME-type Blob serialization, and automated downloads.
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
import { 
  validateReportInput, 
  checkRateLimit, 
  sanitizeText 
} from "./security-utils.js";

const LOCAL_STORAGE_KEY = "access_your_district_reports_v1";
const OFFLINE_QUEUE_KEY = "ayd_offline_queue_v1";

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
 * Verified Government & Civic Directory Layer.
 * @returns {Array<Object>} Array of CivicOffice records
 */
export function getCivicOffices() {
  return [
    {
      id: "civic_congress",
      name: "U.S. House District Office - Constituent Services",
      type: "CONGRESSIONAL",
      lat: 38.8898,
      lng: -77.0090,
      address: "101 Independence Ave SE, Suite 200, Washington, DC",
      phone: "(202) 225-3121",
      services: "Federal constituent advocacy, ADA casework assistance, agency liaison services.",
      status: "VERIFIED_ACCESSIBLE",
      adaFeatures: ["ADA Compliant Ramp", "Automatic Power Doors", "Accessible Elevators", "ASL Interpreters by Request"]
    },
    {
      id: "civic_dpw",
      name: "Department of Public Works (DPW) - Municipal Repairs",
      type: "MUNICIPAL",
      lat: 38.8915,
      lng: -77.0145,
      address: "2000 14th St NW, Civic Maintenance Center",
      phone: "(202) 673-6833",
      services: "Sidewalk repair scheduling, curb cut installation, street signal maintenance.",
      status: "VERIFIED_ACCESSIBLE",
      adaFeatures: ["Zero-Step Entrance", "Braille Signage", "Wheelchair Accessible Service Counters"]
    },
    {
      id: "civic_rights",
      name: "District Disability Rights Commission & Advocacy Legal Center",
      type: "COMMUNITY",
      lat: 38.8872,
      lng: -77.0068,
      address: "500 C St SE, U.S. Civic Center Suite 104",
      phone: "(202) 727-6789",
      services: "ADA compliance enforcement, legal counseling, civic accessibility audits.",
      status: "VERIFIED_ACCESSIBLE",
      adaFeatures: ["Full Wheelchair Accessibility", "Hearing Loop Installed", "Braille & Large Print Materials"]
    },
    {
      id: "civic_library",
      name: "District Central Public Library - Civic Inclusion Wing",
      type: "COMMUNITY",
      lat: 38.8922,
      lng: -77.0030,
      address: "901 G St NW, Central Library Building",
      phone: "(202) 727-0321",
      services: "Assistive technology lab, public Wi-Fi, accessible meeting rooms for community task forces.",
      status: "VERIFIED_ACCESSIBLE",
      adaFeatures: ["Tactile Paving", "Elevator Voice Prompts", "Adjustable Height Computer Desks"]
    },
    {
      id: "civic_transit",
      name: "Metro Transit Access Authority Office (MTAA)",
      type: "TRANSIT",
      lat: 38.8859,
      lng: -77.0112,
      address: "600 5th St NW, Transit Access HQ",
      phone: "(202) 962-1234",
      services: "Paratransit registration, elevator outage reports, accessible transit route mapping.",
      status: "VERIFIED_ACCESSIBLE",
      adaFeatures: ["Level Entry Transit Bay", "Audio-Visual Information Kiosks", "Dedicated Accessibility Concierge"]
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
 * OFFLINE QUEUE METHODS (PWA RESILIENCE IN ZERO-CELL-SERVICE DEAD ZONES)
 * ============================================================================
 */
function getOfflineQueue() {
  try {
    const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    return [];
  }
}

function saveOfflineQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn("⚠️ Error saving offline queue:", err);
  }
}

/**
 * Enqueue a report submitted while offline in the field.
 * @param {Object} report
 */
function enqueueOfflineReport(report) {
  const queue = getOfflineQueue();
  const queuedReport = {
    ...report,
    id: "offline_rep_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    isOfflineQueued: true
  };
  queue.push(queuedReport);
  saveOfflineQueue(queue);

  // Also reflect in local reports so field user sees their pin immediately
  const localReports = getLocalReports();
  localReports.push(queuedReport);
  saveLocalReports(localReports);

  return queuedReport;
}

/**
 * Flush any queued offline reports to Firebase when network connection is restored.
 * @returns {Promise<number>} Number of reports successfully synced
 */
export async function syncOfflineQueue() {
  const queue = getOfflineQueue();
  if (queue.length === 0 || !navigator.onLine) {
    return 0;
  }

  let syncedCount = 0;

  if (isLiveFirebaseConfigured && db) {
    const reportsRef = ref(db, "reports");
    const remainingQueue = [];

    for (const item of queue) {
      try {
        const payload = { ...item };
        delete payload.id;
        delete payload.isOfflineQueued;
        await push(reportsRef, payload);
        syncedCount++;
      } catch (err) {
        console.warn("Failed to sync offline report item:", err);
        remainingQueue.push(item);
      }
    }

    saveOfflineQueue(remainingQueue);
    if (syncedCount > 0) {
      console.log(`📡 [OfflineSync] Successfully flushed ${syncedCount} queued report(s) to Firebase!`);
    }
  }

  return syncedCount;
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
    const reportsRef = ref(db, "reports");
    
    const unsubscribeFirebase = onValue(
      reportsRef,
      (snapshot) => {
        const data = snapshot.val();
        const reportsArray = [];

        if (data) {
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

    return () => {
      subscribers.delete(callback);
      unsubscribeFirebase();
    };
  } else {
    const initialReports = getLocalReports();
    notifySubscribers(initialReports);

    return () => {
      subscribers.delete(callback);
    };
  }
}

/**
 * Submit a new accessibility barrier report with rigorous cybersecurity hardening
 * and PWA offline queue resilience.
 *
 * @param {Object} formData
 * @returns {Promise<Object>} The newly created report object
 */
export async function addReport(formData) {
  const rateCheck = checkRateLimit("report_submit", 15);
  if (!rateCheck.allowed) {
    throw new Error(`⏳ Anti-Spam Rate Limit: Please wait ${rateCheck.remainingSeconds} seconds before submitting another report.`);
  }

  const validation = validateReportInput(formData);
  if (!validation.isValid || !validation.sanitizedData) {
    throw new Error(`⚠️ Validation Error: ${validation.errors.join(" ")}`);
  }

  const newReport = validation.sanitizedData;

  // PWA OFFLINE FIELD CHECK: If browser is offline, store in offline queue
  if (!navigator.onLine) {
    console.info("📡 [Offline Mode] Device is offline. Enqueuing barrier report locally.");
    const queued = enqueueOfflineReport(newReport);
    return { ...queued, wasOfflineSaved: true };
  }

  if (isLiveFirebaseConfigured && db) {
    try {
      const reportsRef = ref(db, "reports");
      const newRef = await push(reportsRef, newReport);
      return {
        id: newRef.key,
        ...newReport
      };
    } catch (err) {
      console.warn("📡 [Firebase Error] Network write failed; saving to offline queue:", err);
      const queued = enqueueOfflineReport(newReport);
      return { ...queued, wasOfflineSaved: true };
    }
  } else {
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

  if (isLiveFirebaseConfigured && db && navigator.onLine) {
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
  if (isLiveFirebaseConfigured && db && navigator.onLine) {
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
 * Reset local demo data back to default sample reports.
 */
export function resetDemoData() {
  const samples = getInitialSampleReports();
  saveLocalReports(samples);
  console.log("🔄 Demo data has been reset to original 5 sample reports.");
}

/**
 * ============================================================================
 * ADVANCED COMPUTER PROGRAMMING SKILL: CSV EXPORT ENGINE FOR CITY PLANNERS
 * ============================================================================
 */
export function exportReportsToCSV(reports = []) {
  if (!reports || reports.length === 0) {
    console.warn("No reports available to export.");
    return null;
  }

  const headers = [
    "Report ID",
    "Location Title / Landmark",
    "Barrier Category",
    "Urgency / Severity",
    "Resolution Status",
    "Latitude",
    "Longitude",
    "Detailed Description",
    "Citizen Confirmations (Upvotes)",
    "Date Reported (ISO 8601)",
    "Epoch Timestamp (ms)"
  ];

  const escapeCsvField = (value) => {
    if (value === null || value === undefined) return '""';
    const stringVal = String(value);
    const escaped = stringVal.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const rows = [headers.map(escapeCsvField).join(",")];

  for (const r of reports) {
    const isoDate = new Date(r.timestamp).toISOString();
    const row = [
      r.id,
      r.title,
      r.category,
      r.severity || "MEDIUM",
      r.status || "OPEN",
      r.lat,
      r.lng,
      r.description,
      r.upvotes || 1,
      isoDate,
      r.timestamp
    ];
    rows.push(row.map(escapeCsvField).join(","));
  }

  const csvContent = rows.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const filename = `AccessYourDistrict_CityPlanner_Export_${dateStr}.csv`;

  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.setAttribute("download", filename);
  downloadLink.style.display = "none";

  document.body.appendChild(downloadLink);
  downloadLink.click();

  setTimeout(() => {
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  }, 300);

  console.log(`✅ [CSV Export] Successfully downloaded '${filename}' (${reports.length} records).`);
  return filename;
}
