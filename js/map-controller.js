/**
 * ============================================================================
 * ACCESSYOURDISTRICT - MAP CONTROLLER (LEAFLET.JS & OPENSTREETMAP)
 * Congressional App Challenge - Civic Inclusion Platform
 * ============================================================================
 *
 * CS LOGIC & MAP ARCHITECTURE EXPLANATION:
 * ----------------------------------------
 * 1. OpenStreetMap Tile Layer API:
 *    - Uses free, crowdsourced OpenStreetMap tile servers (`tile.openstreetmap.org`)
 *      to render interactive street maps without commercial API keys.
 *
 * 2. Marker Data Structure & Dictionary Indexing:
 *    - To maintain smooth performance when real-time updates arrive from
 *      Firebase, we store active Leaflet markers in a JavaScript Map:
 *      `markerMap = new Map<reportId, L.Marker>()`.
 *    - This achieves O(1) lookup time to add, update, or remove individual
 *      markers without re-rendering the entire layer.
 *
 * 3. Geolocation & Interactive Reporting Mode:
 *    - Leverages HTML5 Geolocation API (`navigator.geolocation`) to center on
 *      the citizen's actual congressional district.
 *    - In "Reporting Mode", event delegation captures pixel clicks and converts
 *      them into WGS84 geographic coordinates (Latitude, Longitude).
 * ============================================================================
 */

// Category Metadata Mapping (Icons & Labels for Badges)
const CATEGORY_META = {
  RAMP:     { label: "Broken Ramp", icon: "♿", color: "#3b82f6" },
  SIDEWALK: { label: "Blocked Sidewalk", icon: "🚧", color: "#f59e0b" },
  TACTILE:  { label: "No Tactile Paving", icon: "🦯", color: "#8b5cf6" },
  SIGNAL:   { label: "Audible Signal", icon: "🔊", color: "#10b981" },
  SURFACE:  { label: "Uneven Surface", icon: "⚠️", color: "#ef4444" },
  OTHER:    { label: "Other Barrier", icon: "📌", color: "#64748b" }
};

// Default map view: representative Capitol Hill / congressional district area
const DEFAULT_CENTER = [38.8895, -77.0089];
const DEFAULT_ZOOM = 15;

export class MapController {
  /**
   * @param {string} containerId - DOM ID of map container
   * @param {Object} options
   * @param {Function} options.onReportClick - Callback when user clicks map in Reporting Mode
   * @param {Function} options.onMarkerDetailsClick - Callback when user clicks "View Details" on a pin
   */
  constructor(containerId, { onReportClick, onMarkerDetailsClick }) {
    this.containerId = containerId;
    this.onReportClick = onReportClick;
    this.onMarkerDetailsClick = onMarkerDetailsClick;

    /** @type {L.Map} */
    this.map = null;

    /** @type {L.LayerGroup} */
    this.markerLayer = null;

    /** @type {Map<string, L.Marker>} */
    this.markerMap = new Map();

    /** @type {boolean} */
    this.isReportingMode = false;

    /** @type {L.Marker|null} */
    this.tempDraftMarker = null;

    // Current category filter state ('ALL' or category code)
    this.currentFilter = "ALL";
  }

  /**
   * Initialize the Leaflet map and attach tile layer & event listeners.
   */
  init() {
    // 1. Initialize Leaflet Map
    this.map = L.map(this.containerId, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true
    });

    // 2. Add free OpenStreetMap Standard Tile Layer
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &bull; <strong>AccessYourDistrict</strong>'
    }).addTo(this.map);

    // 3. Create a layer group to hold barrier markers
    this.markerLayer = L.layerGroup().addTo(this.map);

    // 4. Attach Map Click Handler for Reporting Mode
    this.map.on("click", (event) => this.handleMapClick(event));

    console.log("✅ [MapController] Leaflet map initialized successfully.");
  }

  /**
   * Handle user clicks on the map surface.
   * @param {L.LeafletMouseEvent} event
   */
  handleMapClick(event) {
    if (!this.isReportingMode) {
      return; // Normal navigation mode
    }

    const { lat, lng } = event.latlng;
    
    // Show temporary pulsing pin where user clicked
    this.setDraftMarker(lat, lng);

    // Notify application to open reporting modal with lat/lng
    if (typeof this.onReportClick === "function") {
      this.onReportClick(lat, lng);
    }
  }

  /**
   * Toggle interactive reporting mode (crosshair cursor & click capturing).
   * @param {boolean} active
   */
  setReportingMode(active) {
    this.isReportingMode = active;
    const mapContainer = document.getElementById(this.containerId);

    if (active) {
      mapContainer.classList.add("map-reporting-active");
    } else {
      mapContainer.classList.remove("map-reporting-active");
      this.removeDraftMarker();
    }
  }

  /**
   * Place a temporary visual marker when user clicks in Reporting Mode.
   * @param {number} lat
   * @param {number} lng
   */
  setDraftMarker(lat, lng) {
    this.removeDraftMarker();

    const draftIcon = L.divIcon({
      className: "draft-pin-wrapper",
      html: `<div class="custom-pin-icon severity-high" style="animation: pulse 1s infinite;">📍</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    this.tempDraftMarker = L.marker([lat, lng], { icon: draftIcon })
      .addTo(this.map)
      .bindTooltip("New Barrier Location", { permanent: true, direction: "top" })
      .openTooltip();
  }

  /**
   * Remove any temporary draft marker.
   */
  removeDraftMarker() {
    if (this.tempDraftMarker) {
      this.map.removeLayer(this.tempDraftMarker);
      this.tempDraftMarker = null;
    }
  }

  /**
   * Center map on user's actual congressional district using Geolocation API.
   * @param {Function} onSuccess
   * @param {Function} onError
   */
  locateUserDistrict(onSuccess, onError) {
    if (!navigator.geolocation) {
      if (onError) onError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        this.map.setView([latitude, longitude], 15, { animate: true });
        if (onSuccess) onSuccess({ latitude, longitude });
      },
      (error) => {
        console.warn("Geolocation permission denied or unavailable:", error.message);
        // Fallback to default district center
        this.map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });
        if (onError) onError(error.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  /**
   * Smoothly pan and zoom to a specific barrier location.
   * @param {number} lat
   * @param {number} lng
   * @param {string} reportId
   */
  focusOnReport(lat, lng, reportId) {
    this.map.setView([lat, lng], 17, { animate: true });

    const marker = this.markerMap.get(reportId);
    if (marker) {
      marker.openPopup();
    }
  }

  /**
   * Build a custom HTML DivIcon representing a category and severity.
   * @param {Object} report
   * @returns {L.DivIcon}
   */
  buildPinIcon(report) {
    const meta = CATEGORY_META[report.category] || CATEGORY_META.OTHER;
    const severityClass = report.status === "RESOLVED"
      ? "status-resolved"
      : `severity-${(report.severity || "MEDIUM").toLowerCase()}`;

    return L.divIcon({
      className: "custom-pin-container",
      html: `
        <div class="custom-pin-icon ${severityClass}" 
             title="${meta.label} (${report.severity || 'MEDIUM'})"
             role="img" aria-label="${meta.label}">
          ${meta.icon}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -28]
    });
  }

  /**
   * Build HTML content for the Leaflet Popup attached to each marker.
   * @param {Object} report
   * @returns {string} HTML string
   */
  buildPopupHTML(report) {
    const meta = CATEGORY_META[report.category] || CATEGORY_META.OTHER;
    const statusText = report.status === "RESOLVED" ? "✔ RESOLVED" : `🔴 ${report.severity || 'MEDIUM'}`;
    const descExcerpt = report.description.length > 85 
      ? report.description.substring(0, 85) + "..." 
      : report.description;

    return `
      <div class="popup-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-size:0.75rem; font-weight:700; color:#1a56db;">${meta.icon} ${meta.label}</span>
          <span style="font-size:0.7rem; font-weight:700; color:#64748b;">${statusText}</span>
        </div>
        <h4 class="popup-title">${report.title}</h4>
        <p class="popup-desc">${descExcerpt}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#64748b; margin-top:4px;">
          <span>👍 ${report.upvotes || 1} confirmations</span>
        </div>
        <button class="btn btn-sm btn-primary popup-btn" 
                onclick="window.dispatchEvent(new CustomEvent('open-report-details', { detail: '${report.id}' }))">
          View Full Details
        </button>
      </div>
    `;
  }

  /**
   * Synchronize Leaflet map markers with the latest reports array from Firebase.
   * Automatically filters out reports if a category filter is active.
   *
   * @param {Array<Object>} reports
   * @param {string} currentCategoryFilter - 'ALL' or category code
   */
  syncMarkers(reports, currentCategoryFilter = "ALL") {
    this.currentFilter = currentCategoryFilter;

    // Track active report IDs to prune deleted markers
    const activeIds = new Set();

    for (const report of reports) {
      // Apply Category Filter
      if (currentCategoryFilter !== "ALL" && report.category !== currentCategoryFilter) {
        // If marker exists on map, remove it temporarily while filtered
        if (this.markerMap.has(report.id)) {
          this.markerLayer.removeLayer(this.markerMap.get(report.id));
          this.markerMap.delete(report.id);
        }
        continue;
      }

      activeIds.add(report.id);

      const existingMarker = this.markerMap.get(report.id);
      const icon = this.buildPinIcon(report);
      const popupHtml = this.buildPopupHTML(report);

      if (existingMarker) {
        // Update existing marker position & popup without recreating
        existingMarker.setLatLng([report.lat, report.lng]);
        existingMarker.setIcon(icon);
        existingMarker.setPopupContent(popupHtml);
      } else {
        // Create new marker
        const newMarker = L.marker([report.lat, report.lng], {
          icon: icon,
          title: report.title
        });

        newMarker.bindPopup(popupHtml, {
          closeButton: true,
          autoPan: true
        });

        this.markerLayer.addLayer(newMarker);
        this.markerMap.set(report.id, newMarker);
      }
    }

    // Remove markers that are no longer in the filtered dataset
    for (const [id, marker] of this.markerMap.entries()) {
      if (!activeIds.has(id)) {
        this.markerLayer.removeLayer(marker);
        this.markerMap.delete(id);
      }
    }
  }
}

export { CATEGORY_META };
