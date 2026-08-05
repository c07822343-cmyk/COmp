/**
 * ============================================================================
 * ACCESSYOURDISTRICT - MAIN APPLICATION ORCHESTRATOR & PWA CONTROLLER
 * Congressional App Challenge - Civic Inclusion Platform
 * ============================================================================
 *
 * ARCHITECTURE, DATA FLOW, PWA & SOCIETAL USE EXPLANATION:
 * --------------------------------------------------------
 * 1. Web Storage API (localStorage) Persistence:
 *    - Replaces Firebase 'push' and 'onValue' with 100% self-contained local
 *      JSON string storage on the user's browser (`localStorage`).
 *
 * 2. Self-Contained Static District Map Mode (`L.CRS.Simple`):
 *    - Visitors can toggle between Live OpenStreetMap tile mode ('OSM') and a
 *      self-contained Cartesian coordinate static image map of Florida's 23rd
 *      Congressional District ('STATIC_IMAGE'), allowing offline pinning
 *      without tile servers.
 *
 * 3. Progressive Web App (PWA) & Offline Caching Architecture:
 *    - Registers `service-worker.js` to precache the static app shell and
 *      external Leaflet.js libraries (`leaflet.css`, `leaflet.js`).
 *    - Captures the native PWA `beforeinstallprompt` event so users can install
 *      AccessYourDistrict directly to their smartphone home screen.
 *
 * 4. Dynamic District Header (Civic Representative Info):
 *    - Uses `districtConfig` JSON object and `renderDistrictHeader()` to bind
 *      the Representative's name, district code, phone, and official House.gov
 *      contact URL dynamically to the top of the application.
 *
 * 5. Societal Use (Civic Resource & Government Directory Layer):
 *    - Integrates `getCivicOffices()` to display verified ADA-accessible local
 *      government and congressional offices on the map and in the sidebar.
 *    - Implements CSV Export (`exportReportsToCSV`) so city planners and DPW
 *      engineers can import crowdsourced citizen reports into municipal GIS systems.
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
        // Submit report with current active mapMode (OSM vs STATIC_IMAGE)
        const enrichedForm = {
          ...formData,
          mapMode: this.map.mapMode
        };
        await addReport(enrichedForm);
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
    this.ui.setDatabaseStatus(false); // Explicitly display LocalStorage Web Storage API mode

    // 3. Bind top Navigation Bar Actions & PWA Install Prompt
    this.bindHeaderActions();
    this.initPWA();

    // 4. Subscribe to persistent reports from localStorage via Web Storage API
    subscribeToReports((reports) => {
      this.latestReports = reports;
      this.ui.updateSidebar(reports, this.civicOffices);
      this.map.syncMarkers(this.ui.filteredReports);
      this.map.syncCivicOffices(this.civicOffices, true);
    });

    // 5. AUTOMATIC GEOLOCATION API CALL ON OPEN (SOCIETAL PORTABILITY)
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
      updateDistrict: (newConfig) => renderDistrictHeader(newConfig),
      toggleMapMode: () => this.toggleMapMode()
    };
  }

  /**
   * Toggle between Live OSM view and Self-Contained Static District Map Mode (`L.CRS.Simple`).
   */
  toggleMapMode() {
    const currentMode = this.map.mapMode;
    const nextMode = currentMode === "OSM" ? "STATIC_IMAGE" : "OSM";

    this.map.switchMapMode(nextMode);

    const btnLabel = document.getElementById("map-mode-label");
    if (btnLabel) {
      btnLabel.textContent = nextMode === "STATIC_IMAGE" ? "Live OSM Mode" : "Static Map Mode";
    }

    // Synchronize markers on new coordinate grid
    this.map.syncMarkers(this.ui.filteredReports);
    this.map.syncCivicOffices(this.civicOffices, true);

    this.ui.showToast(
      nextMode === "STATIC_IMAGE"
        ? "🖼️ Activated Self-Contained Static District Map Mode (L.CRS.Simple)"
        : "🌐 Restored Live OpenStreetMap Geographical Mode",
      "success"
    );
  }

  /**
   * Initialize Progressive Web App (PWA) Service Worker.
   */
  initPWA() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("./service-worker.js")
          .then((reg) => {
            console.log("✅ [ServiceWorker] Registered successfully with scope:", reg.scope);
          })
          .catch((err) => {
            console.warn("⚠️ [ServiceWorker] Registration failed:", err);
          });
      });
    }

    let deferredPrompt = null;
    const installBtn = document.getElementById("btn-install-pwa");

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (installBtn) {
        installBtn.classList.remove("hidden");
      }
      console.log("📲 [PWA] App installation prompt available.");
    });

    if (installBtn) {
      installBtn.addEventListener("click", async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          console.log("✅ [PWA] Citizen accepted home screen installation!");
          installBtn.classList.add("hidden");
        }
        deferredPrompt = null;
      });
    }
  }

  /**
   * Bind header action buttons (My District, Report Barrier, Cancel Report, Switch Map Mode).
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

    const btnSwitchMode = document.getElementById("btn-switch-map-mode");
    if (btnSwitchMode) {
      btnSwitchMode.addEventListener("click", () => this.toggleMapMode());
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
