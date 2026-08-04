/**
 * ============================================================================
 * ACCESSYOURDISTRICT - MAIN APPLICATION ORCHESTRATOR
 * Congressional App Challenge - Civic Inclusion Platform
 * ============================================================================
 *
 * ARCHITECTURE & ES MODULE WIRING:
 * --------------------------------
 * 1. Modular Architecture:
 *    - `app.js`: Coordinates communication between the visual UI controller,
 *      interactive map controller, and persistent Firebase/demo data layer.
 *    - Designed for GitHub Pages without requiring Node/Vite build steps.
 *
 * 2. Real-time Event Loop:
 *    - Subscribes to `ReportService.subscribeToReports(...)` which listens to
 *      Firebase WebSockets.
 *    - When the database changes (new barrier reported by another citizen, an
 *      upvote, or status change), both the Leaflet map and the Sidebar report
 *      list update atomically.
 * ============================================================================
 */

import { isLiveFirebaseConfigured } from "./firebase-config.js";
import { 
  subscribeToReports, 
  addReport, 
  upvoteReport, 
  resolveReport,
  resetDemoData 
} from "./report-service.js";
import { MapController } from "./map-controller.js";
import { UIController } from "./ui-controller.js";

class AccessYourDistrictApp {
  constructor() {
    /** @type {Array<Object>} */
    this.latestReports = [];

    // 1. Initialize UI Controller with event callbacks
    this.ui = new UIController({
      onReportSubmit: async (formData) => {
        await addReport(formData);
      },
      onFilterChange: (filteredReports, _selectedCategories) => {
        // Synchronize map markers with whatever is currently visible in UI filter/search
        this.map.syncMarkers(filteredReports);
      },
      onReportSelect: (lat, lng, reportId) => {
        this.map.focusOnReport(lat, lng, reportId);
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
      }
    });

    // 2. Initialize Map Controller with click & details callbacks
    this.map = new MapController("map", {
      onReportClick: (lat, lng) => {
        // Exit reporting mode visual state and open modal
        this.exitReportingMode();
        this.ui.openReportModal(lat, lng);
      },
      onMarkerDetailsClick: (reportId) => {
        this.ui.openDetailsModal(reportId);
      }
    });
  }

  /**
   * Bootstrap the application on page load.
   */
  init() {
    console.log("🚀 [AccessYourDistrict] Initializing civic accessibility platform...");

    // 1. Initialize Map & UI DOM event listeners
    this.map.init();
    this.ui.init();
    this.ui.setDatabaseStatus(isLiveFirebaseConfigured);

    // 2. Bind top Navigation Bar Actions
    this.bindHeaderActions();

    // 3. Subscribe to real-time reports from Firebase / Demo DB
    subscribeToReports((reports) => {
      this.latestReports = reports;
      this.ui.updateSidebar(reports);
      // Ensure initial map sync uses filtered array from UIController
      this.map.syncMarkers(this.ui.filteredReports);
    });

    // 4. Try locating user district automatically or default to Capitol Hill
    this.map.locateUserDistrict(
      (coords) => {
        console.log(`📍 Centered on user's district: ${coords.latitude}, ${coords.longitude}`);
      },
      () => {
        console.log("ℹ️ Using default district view (Washington D.C. Capitol Hill area).");
      }
    );

    // Expose app debug helper in console for evaluation
    window.AYD = {
      resetDemo: () => resetDemoData(),
      getReports: () => this.latestReports,
      toggleHighContrast: () => this.ui.toggleHighContrast()
    };
  }

  /**
   * Bind header action buttons (My District, Report Barrier, Cancel Report).
   */
  bindHeaderActions() {
    // Center on My District button
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

    // Report Barrier primary button
    const btnStartReport = document.getElementById("btn-start-report");
    if (btnStartReport) {
      btnStartReport.addEventListener("click", () => this.enterReportingMode());
    }

    // Cancel Reporting Mode button inside banner
    const btnCancelReport = document.getElementById("btn-cancel-report");
    if (btnCancelReport) {
      btnCancelReport.addEventListener("click", () => this.exitReportingMode());
    }

    // Escape key shortcut to cancel reporting mode
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
