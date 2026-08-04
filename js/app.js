/**
 * ============================================================================
 * ACCESSYOURDISTRICT - MAIN APPLICATION ORCHESTRATOR
 * Congressional App Challenge - Civic Inclusion Platform
 * ============================================================================
 *
 * ARCHITECTURE, DATA FLOW & SOCIETAL USE EXPLANATION:
 * ---------------------------------------------------
 * 1. Dynamic District Header (Civic Representative Info):
 *    - Uses `districtConfig` JSON object and `renderDistrictHeader()` to bind
 *      the Representative's name, district code, phone, and official House.gov
 *      contact URL dynamically to the top of the application.
 *
 * 2. Societal Use (Civic Resource & Government Directory Layer):
 *    - Integrates `getCivicOffices()` to display verified ADA-accessible local
 *      government and congressional offices on the map and in the sidebar.
 *    - Implements CSV Export (`exportReportsToCSV`) so city planners and DPW
 *      engineers can import crowdsourced citizen reports into municipal GIS systems.
 *
 * 3. Automated Geolocation API Integration:
 *    - On launch, the browser Geolocation API centers the map automatically on
 *      the resident's current position and places a "You Are Here" pin.
 *
 * 4. End-to-End Technical Data Flow (Summary for Video Submission):
 *    [User Map Click / Form Submit]
 *                 │
 *                 ▼
 *    [UIController Input Validation & Serialization]
 *                 │
 *                 ▼
 *    [ReportService.addReport() -> Firebase Realtime DB push()]
 *                 │
 *                 ▼ (WebSockets Broadcast in < 100ms)
 *    [Firebase onValue() Listener -> notifySubscribers()]
 *                 │
 *                 ▼
 *    [UIController Filter Pipeline & MapController O(1) Map Diffing]
 * ============================================================================
 */

import { isLiveFirebaseConfigured } from "./firebase-config.js";
import { 
  subscribeToReports, 
  addReport, 
  upvoteReport, 
  resolveReport,
  resetDemoData,
  getCivicOffices,
  exportReportsToCSV
} from "./report-service.js";
import { districtConfig, renderDistrictHeader } from "./district-config.js";
import { MapController } from "./map-controller.js";
import { UIController } from "./ui-controller.js";

class AccessYourDistrictApp {
  constructor() {
    /** @type {Array<Object>} */
    this.latestReports = [];

    /** @type {Array<Object>} */
    this.civicOffices = getCivicOffices();

    // 1. Initialize UI Controller with event callbacks
    this.ui = new UIController({
      onReportSubmit: async (formData) => {
        await addReport(formData);
      },
      onFilterChange: (filteredReports, _selectedCategories) => {
        this.map.syncMarkers(filteredReports);
      },
      onReportSelect: (lat, lng, reportId) => {
        this.map.focusOnReport(lat, lng, reportId);
      },
      onCivicOfficeSelect: (lat, lng, officeId) => {
        this.map.focusOnCivicOffice(lat, lng, officeId);
      },
      onUpvote: async (reportId) => {
        const target = this.latestReports.find((r) => r.id === reportId);
        const currentCount = target ? target.upvotes : 0;
        await upvoteReport(reportId, currentCount);
        this.ui.showToast("👍 Thank you for confirming this barrier!", "success");
      },
      onResolve: async (reportId) => {
        await resolveReport(reportId);
        this.ui.showToast("✔ Marked barrier as RESOLVED!", "success");
      },
      onExportCSV: () => {
        const filename = exportReportsToCSV(this.latestReports);
        if (filename) {
          this.ui.showToast("📥 Successfully exported CSV report for city planners!", "success");
        } else {
          this.ui.showToast("⚠️ No reports available to export.", "error");
        }
      }
    });

    // 2. Initialize Map Controller with click & details callbacks
    this.map = new MapController("map", {
      onReportClick: (lat, lng) => {
        this.exitReportingMode();
        this.ui.openReportModal(lat, lng);
      },
      onMarkerDetailsClick: (reportId) => {
        this.ui.openDetailsModal(reportId);
      },
      onCivicOfficeClick: (officeId) => {
        this.ui.openCivicModal(officeId);
      }
    });
  }

  /**
   * Bootstrap the application on page load.
   */
  init() {
    console.log("🚀 [AccessYourDistrict] Initializing civic accessibility platform...");

    // 1. Render Dynamic District Header from JSON Config
    renderDistrictHeader(districtConfig);

    // 2. Initialize Map & UI DOM event listeners
    this.map.init();
    this.ui.init();
    this.ui.setDatabaseStatus(isLiveFirebaseConfigured);

    // 3. Bind top Navigation Bar Actions
    this.bindHeaderActions();

    // 4. Subscribe to real-time reports from Firebase / Demo DB
    subscribeToReports((reports) => {
      this.latestReports = reports;
      this.ui.updateSidebar(reports, this.civicOffices);
      this.map.syncMarkers(this.ui.filteredReports);
      this.map.syncCivicOffices(this.civicOffices, true);
    });

    // 5. AUTOMATIC GEOLOCATION API CALL ON OPEN (SOCIETAL PORTABILITY)
    // Centers map on the user's actual browser coordinates with a "You Are Here" marker
    this.map.locateUserDistrict(
      (coords) => {
        console.log(`📍 Centered automatically on user location: ${coords.latitude}, ${coords.longitude}`);
        this.ui.showToast("📍 Centered on your local congressional district!", "success");
      },
      () => {
        console.log("ℹ️ Geolocation unavailable; displaying default representative district (Capitol Hill).");
      }
    );

    // Expose debug & testing helpers for evaluation
    window.AYD = {
      resetDemo: () => resetDemoData(),
      getReports: () => this.latestReports,
      getCivicOffices: () => this.civicOffices,
      exportCSV: () => exportReportsToCSV(this.latestReports),
      toggleHighContrast: () => this.ui.toggleHighContrast(),
      updateDistrict: (newConfig) => renderDistrictHeader(newConfig)
    };
  }

  /**
   * Bind header action buttons (My District, Report Barrier, Cancel Report).
   */
  bindHeaderActions() {
    const btnLocate = document.getElementById("btn-locate");
    if (btnLocate) {
      btnLocate.addEventListener("click", () => {
        this.ui.showToast("📍 Locating your congressional district...", "success");
        this.map.locateUserDistrict(
          () => this.ui.showToast("📍 Centered on your district location!", "success"),
          () => this.ui.showToast("⚠️ Could not detect location. Displaying default district.", "error")
        );
      });
    }

    const btnStartReport = document.getElementById("btn-start-report");
    if (btnStartReport) {
      btnStartReport.addEventListener("click", () => this.enterReportingMode());
    }

    const btnCancelReport = document.getElementById("btn-cancel-report");
    if (btnCancelReport) {
      btnCancelReport.addEventListener("click", () => this.exitReportingMode());
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.map.isReportingMode) {
        this.exitReportingMode();
      }
    });
  }

  /**
   * Enter interactive Reporting Mode.
   */
  enterReportingMode() {
    this.map.setReportingMode(true);
    const banner = document.getElementById("reporting-mode-banner");
    if (banner) banner.classList.remove("hidden");
    this.ui.showToast("📍 Click anywhere on the map where you noticed a barrier.", "success");
  }

  /**
   * Exit interactive Reporting Mode.
   */
  exitReportingMode() {
    this.map.setReportingMode(false);
    const banner = document.getElementById("reporting-mode-banner");
    if (banner) banner.classList.add("hidden");
  }
}

// Instantiate and start application when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const app = new AccessYourDistrictApp();
  app.init();
});
