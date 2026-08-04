/**
 * ============================================================================
 * ACCESSYOURDISTRICT - UI CONTROLLER (DOM EVENT HANDLING & MODAL DIALOGS)
 * Congressional App Challenge - Civic Inclusion Platform
 * ============================================================================
 *
 * CS LOGIC & UI ARCHITECTURE EXPLANATION:
 * ---------------------------------------
 * 1. Separation of Concerns (MVC Pattern):
 *    - UIController manages only DOM rendering, user input validation,
 *      and accessibility state (ARIA attributes).
 *    - Delegates all persistence and network API calls to `ReportService`,
 *      and delegates map coordinates/view state to `MapController`.
 *
 * 2. Dynamic DOM Updates & Category Statistics:
 *    - When real-time data arrives from Firebase, `updateSidebar()` recalculates
 *      category breakdown frequencies and renders responsive report cards.
 * ============================================================================
 */

import { CATEGORY_META } from "./map-controller.js";

export class UIController {
  /**
   * @param {Object} callbacks - Application callbacks for user actions
   * @param {Function} callbacks.onReportSubmit - Called when user submits new barrier
   * @param {Function} callbacks.onFilterChange - Called when category filter changes
   * @param {Function} callbacks.onReportSelect - Called when user clicks a sidebar item
   * @param {Function} callbacks.onUpvote - Called when user upvotes a report
   * @param {Function} callbacks.onResolve - Called when user resolves a report
   */
  constructor(callbacks) {
    this.callbacks = callbacks;

    // Active dataset reference for details modal lookup
    this.currentReports = [];
    this.activeFilter = "ALL";

    // Currently opened report in details modal
    this.selectedReportId = null;

    // Cache DOM references
    this.reportsContainer = document.getElementById("reports-list-container");
    this.reportModal = document.getElementById("report-modal");
    this.detailsModal = document.getElementById("details-modal");
    this.reportForm = document.getElementById("report-form");
    this.toastContainer = document.getElementById("toast-container");
    this.dbStatusBadge = document.getElementById("db-status-badge");
  }

  /**
   * Attach all UI event listeners (filter chips, modal close buttons, form submit).
   */
  init() {
    // 1. Category Filter Chip Buttons
    const filterButtons = document.querySelectorAll(".category-filters .chip");
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const category = btn.getAttribute("data-category");
        this.setCategoryFilter(category);
      });
    });

    // 2. Reset Filters Button
    const resetBtn = document.getElementById("btn-reset-filters");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.setCategoryFilter("ALL"));
    }

    // 3. Close Report Modal Buttons
    const closeReportBtn = document.getElementById("btn-close-modal");
    const cancelReportBtn = document.getElementById("btn-cancel-modal");
    [closeReportBtn, cancelReportBtn].forEach((btn) => {
      if (btn) btn.addEventListener("click", () => this.closeReportModal());
    });

    // 4. Report Form Submit Handler
    if (this.reportForm) {
      this.reportForm.addEventListener("submit", (e) => this.handleReportSubmit(e));
    }

    // 5. Details Modal Close Button
    const closeDetailsBtn = document.getElementById("btn-close-details");
    if (closeDetailsBtn) {
      closeDetailsBtn.addEventListener("click", () => this.closeDetailsModal());
    }

    // 6. Upvote Button in Details Modal
    const upvoteBtn = document.getElementById("btn-upvote-report");
    if (upvoteBtn) {
      upvoteBtn.addEventListener("click", () => {
        if (this.selectedReportId && typeof this.callbacks.onUpvote === "function") {
          this.callbacks.onUpvote(this.selectedReportId);
        }
      });
    }

    // 7. Resolve Button in Details Modal
    const resolveBtn = document.getElementById("btn-resolve-report");
    if (resolveBtn) {
      resolveBtn.addEventListener("click", () => {
        if (this.selectedReportId && typeof this.callbacks.onResolve === "function") {
          this.callbacks.onResolve(this.selectedReportId);
          this.closeDetailsModal();
        }
      });
    }

    // 8. Custom Window Event for Leaflet Popup Details Button
    window.addEventListener("open-report-details", (event) => {
      const reportId = event.detail;
      this.openDetailsModal(reportId);
    });
  }

  /**
   * Update the database connection status badge in header.
   * @param {boolean} isLiveFirebase
   */
  setDatabaseStatus(isLiveFirebase) {
    if (!this.dbStatusBadge) return;

    if (isLiveFirebase) {
      this.dbStatusBadge.className = "status-badge live-mode";
      this.dbStatusBadge.innerHTML = `
        <span class="status-dot"></span>
        <span class="status-text">Connected to Firebase Realtime DB</span>
      `;
    } else {
      this.dbStatusBadge.className = "status-badge demo-mode";
      this.dbStatusBadge.innerHTML = `
        <span class="status-dot"></span>
        <span class="status-text">Demo Mode (Local Storage)</span>
      `;
    }
  }

  /**
   * Update sidebar stats, filter counts, and report cards list.
   * @param {Array<Object>} reports - All reports from database
   */
  updateSidebar(reports) {
    this.currentReports = reports;

    // 1. Compute Overall Statistics
    const total = reports.length;
    const highCount = reports.filter((r) => r.severity === "HIGH" && r.status !== "RESOLVED").length;
    const resolvedCount = reports.filter((r) => r.status === "RESOLVED").length;

    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-high").textContent = highCount;
    document.getElementById("stat-resolved").textContent = resolvedCount;

    // 2. Compute Category Frequencies for Filter Badges
    const categoryCounts = {
      ALL: total,
      RAMP: 0,
      SIDEWALK: 0,
      TACTILE: 0,
      SIGNAL: 0,
      SURFACE: 0,
      OTHER: 0
    };

    for (const r of reports) {
      if (categoryCounts[r.category] !== undefined) {
        categoryCounts[r.category]++;
      } else {
        categoryCounts.OTHER++;
      }
    }

    Object.keys(categoryCounts).forEach((cat) => {
      const el = document.getElementById(`count-${cat}`);
      if (el) el.textContent = categoryCounts[cat];
    });

    // 3. Render Filtered List of Cards
    this.renderReportsList();
  }

  /**
   * Render report cards in the sidebar corresponding to the active filter.
   */
  renderReportsList() {
    if (!this.reportsContainer) return;

    // Filter reports by selected category
    const filtered = this.activeFilter === "ALL"
      ? this.currentReports
      : this.currentReports.filter((r) => r.category === this.activeFilter);

    if (filtered.length === 0) {
      this.reportsContainer.innerHTML = `
        <div class="empty-state">
          <p>No accessibility barriers found in this category.</p>
          <p style="font-size:0.75rem; margin-top:0.35rem; color:#94a3b8;">
            Click <strong>"Report Barrier"</strong> to pin an issue on the map.
          </p>
        </div>
      `;
      return;
    }

    // Build HTML markup for each card
    const markup = filtered.map((report) => {
      const meta = CATEGORY_META[report.category] || CATEGORY_META.OTHER;
      const statusClass = report.status === "RESOLVED" ? "resolved" : "";
      const dateStr = new Date(report.timestamp).toLocaleDateString();

      return `
        <article class="report-card ${statusClass}" 
                 role="article" 
                 data-report-id="${report.id}"
                 tabindex="0"
                 aria-label="${report.title}, Category: ${meta.label}">
          <div class="report-card-header">
            <span style="font-size:0.75rem; font-weight:700; color:#1a56db;">
              ${meta.icon} ${meta.label}
            </span>
            <span class="badge severity-${report.severity || 'MEDIUM'}">
              ${report.status === "RESOLVED" ? "✔ RESOLVED" : report.severity}
            </span>
          </div>
          <h4 class="report-card-title">${report.title}</h4>
          <p class="report-card-desc">${report.description}</p>
          <div class="report-card-footer">
            <span>📅 ${dateStr}</span>
            <span class="report-card-upvotes">👍 ${report.upvotes || 1}</span>
          </div>
        </article>
      `;
    }).join("");

    this.reportsContainer.innerHTML = markup;

    // Attach click and keyboard handlers to each card
    const cards = this.reportsContainer.querySelectorAll(".report-card");
    cards.forEach((card) => {
      const reportId = card.getAttribute("data-report-id");

      card.addEventListener("click", () => {
        const target = this.currentReports.find((r) => r.id === reportId);
        if (target && typeof this.callbacks.onReportSelect === "function") {
          this.callbacks.onReportSelect(target.lat, target.lng, reportId);
        }
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  /**
   * Set active category filter and update UI styling.
   * @param {string} category
   */
  setCategoryFilter(category) {
    this.activeFilter = category;

    // Update Chip Button active states
    const buttons = document.querySelectorAll(".category-filters .chip");
    buttons.forEach((btn) => {
      const isMatch = btn.getAttribute("data-category") === category;
      btn.classList.toggle("active", isMatch);
      btn.setAttribute("aria-pressed", isMatch ? "true" : "false");
    });

    // Toggle Reset Button visibility
    const resetBtn = document.getElementById("btn-reset-filters");
    if (resetBtn) {
      resetBtn.classList.toggle("hidden", category === "ALL");
    }

    // Refresh sidebar and notify MapController
    this.renderReportsList();
    if (typeof this.callbacks.onFilterChange === "function") {
      this.callbacks.onFilterChange(category);
    }
  }

  /**
   * Open the new barrier report modal with coordinates pre-populated.
   * @param {number} lat
   * @param {number} lng
   */
  openReportModal(lat, lng) {
    if (!this.reportModal) return;

    // Populate hidden lat/lng inputs & coordinates display label
    document.getElementById("report-lat").value = lat;
    document.getElementById("report-lng").value = lng;
    
    const coordsDisplay = document.getElementById("modal-coords-display");
    if (coordsDisplay) {
      coordsDisplay.textContent = `Selected Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    // Reset form fields
    this.reportForm.reset();
    document.getElementById("report-category").selectedIndex = 0;

    // Show native HTML5 <dialog>
    if (typeof this.reportModal.showModal === "function") {
      this.reportModal.showModal();
    } else {
      this.reportModal.setAttribute("open", "true");
    }

    // Focus first text field
    setTimeout(() => {
      const titleInput = document.getElementById("report-location-title");
      if (titleInput) titleInput.focus();
    }, 100);
  }

  /**
   * Close report modal dialog.
   */
  closeReportModal() {
    if (!this.reportModal) return;

    if (typeof this.reportModal.close === "function") {
      this.reportModal.close();
    } else {
      this.reportModal.removeAttribute("open");
    }
  }

  /**
   * Validate form fields and submit report.
   * @param {SubmitEvent} e
   */
  async handleReportSubmit(e) {
    e.preventDefault();

    const titleInput = document.getElementById("report-location-title");
    const categorySelect = document.getElementById("report-category");
    const descInput = document.getElementById("report-description");
    const latInput = document.getElementById("report-lat");
    const lngInput = document.getElementById("report-lng");

    const severityRadio = document.querySelector('input[name="severity"]:checked');

    if (!titleInput.value.trim() || !categorySelect.value || !descInput.value.trim()) {
      this.showToast("Please fill in all required fields marked with *", "error");
      return;
    }

    const submitBtn = document.getElementById("btn-submit-report");
    const originalText = submitBtn ? submitBtn.innerHTML : "Submit Report";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Saving to Database...</span>`;
    }

    const formData = {
      title: titleInput.value.trim(),
      category: categorySelect.value,
      lat: Number(latInput.value),
      lng: Number(lngInput.value),
      description: descInput.value.trim(),
      severity: severityRadio ? severityRadio.value : "MEDIUM"
    };

    try {
      if (typeof this.callbacks.onReportSubmit === "function") {
        await this.callbacks.onReportSubmit(formData);
      }
      this.closeReportModal();
      this.showToast("🎉 Barrier report successfully pinned to map!", "success");
    } catch (error) {
      console.error("Error submitting report:", error);
      this.showToast("❌ Failed to save report. Please try again.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  }

  /**
   * Open Details Modal for a specific report ID.
   * @param {string} reportId
   */
  openDetailsModal(reportId) {
    const report = this.currentReports.find((r) => r.id === reportId);
    if (!report || !this.detailsModal) return;

    this.selectedReportId = reportId;

    const meta = CATEGORY_META[report.category] || CATEGORY_META.OTHER;
    const dateStr = new Date(report.timestamp).toLocaleString();

    // Populate fields
    document.getElementById("details-category-badge").textContent = `${meta.icon} ${meta.label}`;
    const severityBadge = document.getElementById("details-severity-badge");
    severityBadge.textContent = report.severity || "MEDIUM";
    severityBadge.className = `badge severity-${report.severity || 'MEDIUM'}`;

    document.getElementById("details-title").textContent = report.title;
    document.getElementById("details-description").textContent = report.description;
    document.getElementById("details-coords").textContent = `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`;
    document.getElementById("details-timestamp").textContent = dateStr;
    
    const statusEl = document.getElementById("details-status");
    statusEl.textContent = report.status || "OPEN";
    statusEl.className = `status-pill ${report.status === 'RESOLVED' ? 'resolved' : ''}`;

    document.getElementById("details-upvotes").textContent = report.upvotes || 1;

    // Hide resolve button if already resolved
    const resolveBtn = document.getElementById("btn-resolve-report");
    if (resolveBtn) {
      resolveBtn.style.display = report.status === "RESOLVED" ? "none" : "inline-flex";
    }

    if (typeof this.detailsModal.showModal === "function") {
      this.detailsModal.showModal();
    } else {
      this.detailsModal.setAttribute("open", "true");
    }
  }

  /**
   * Close Details Modal.
   */
  closeDetailsModal() {
    if (!this.detailsModal) return;
    if (typeof this.detailsModal.close === "function") {
      this.detailsModal.close();
    } else {
      this.detailsModal.removeAttribute("open");
    }
    this.selectedReportId = null;
  }

  /**
   * Display a non-blocking toast notification.
   * @param {string} message
   * @param {string} type - 'success' | 'error'
   */
  showToast(message, type = "success") {
    if (!this.toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.4s ease";
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }
}
