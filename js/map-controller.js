/**
 * ============================================================================
 * ACCESSYOURDISTRICT - MAP CONTROLLER (OSM & SELF-CONTAINED STATIC MAP MODE)
 * Congressional App Challenge - Civic Inclusion Platform
 * ============================================================================
 *
 * SENIOR WEB DEVELOPER ARCHITECTURE EXPLANATION:
 * ----------------------------------------------
 * 1. Self-Contained Static Map Coordinate System (`L.CRS.Simple`):
 *    - Instead of relying on a live tile API, this app supports a self-contained
 *      static image coordinate system using `L.CRS.Simple`.
 *    - A static vector image of the Congressional District (`district-map-static.svg`)
 *      is mapped to a Cartesian coordinate grid from `[0, 0]` to `[1000, 1000]`.
 *    - Interactive HTML `<div class="custom-pin-icon">` elements are placed
 *      precisely at those Cartesian `(Y, X)` coordinates as persistent pins!
 *
 * 2. Map Mode Switcher (`this.mapMode`):
 *    - Visitors can toggle between `'OSM'` (Live OpenStreetMap WGS84 GPS view)
 *      and `'STATIC_IMAGE'` (Self-Contained Cartesian Static District Map view).
 *
 * 3. Screen Reader ARIA Labels & Keyboard Accessibility:
 *    - Every map marker icon DOM element is decorated with `role="button"`,
 *      `tabindex="0"`, and descriptive `aria-label` attributes.
 * ============================================================================
 */

import { escapeHTML } from "./security-utils.js";

const CATEGORY_META = {
  RAMP:     { label: "Broken Ramp", icon: "♿", color: "#0d47a1" },
  SIDEWALK: { label: "Blocked Sidewalk", icon: "🚧", color: "#b45309" },
  TACTILE:  { label: "No Tactile Paving", icon: "🦯", color: "#6b21a8" },
  SIGNAL:   { label: "Audible Signal", icon: "🔊", color: "#047857" },
  SURFACE:  { label: "Uneven Surface", icon: "⚠️", color: "#b91c1c" },
  OTHER:    { label: "Other Barrier", icon: "📌", color: "#475569" }
};

const DEFAULT_CENTER = [38.8895, -77.0089];
const DEFAULT_ZOOM = 15;

const STATIC_BOUNDS = [[0, 0], [1000, 1000]];
const STATIC_CENTER = [500, 500];

export class MapController {
  /**
   * @param {string} containerId - DOM ID of map container
   * @param {Object} options
   * @param {Function} options.onReportClick
   * @param {Function} options.onMarkerDetailsClick
   * @param {Function} [options.onCivicOfficeClick]
   */
  constructor(containerId, { onReportClick, onMarkerDetailsClick, onCivicOfficeClick }) {
    this.containerId = containerId;
    this.onReportClick = onReportClick;
    this.onMarkerDetailsClick = onMarkerDetailsClick;
    this.onCivicOfficeClick = onCivicOfficeClick;

    /** @type {L.Map} */
    this.map = null;

    /** @type {string} - "OSM" | "STATIC_IMAGE" */
    this.mapMode = "OSM";

    /** @type {L.TileLayer|null} */
    this.tileLayer = null;

    /** @type {L.ImageOverlay|null} */
    this.imageOverlay = null;

    /** @type {L.LayerGroup} */
    this.markerLayer = null;

    /** @type {L.LayerGroup} */
    this.civicLayer = null;

    /** @type {Map<string, L.Marker>} */
    this.markerMap = new Map();

    /** @type {Map<string, L.Marker>} */
    this.civicMarkerMap = new Map();

    /** @type {boolean} */
    this.isReportingMode = false;

    /** @type {L.Marker|null} */
    this.tempDraftMarker = null;

    /** @type {L.Marker|null} */
    this.userLocationMarker = null;
  }

  /**
   * Initialize the Leaflet map in default OSM mode.
   */
  init() {
    this.map = L.map(this.containerId, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true
    });

    this.tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &bull; <strong>AccessYourDistrict</strong>'
    }).addTo(this.map);

    this.markerLayer = L.layerGroup().addTo(this.map);
    this.civicLayer = L.layerGroup().addTo(this.map);

    this.map.on("click", (event) => this.handleMapClick(event));

    console.log("✅ [MapController] Leaflet map initialized successfully in OSM mode.");
  }

  /**
   * Switch between Live OSM Tile mode and Self-Contained Static District Map mode (`L.CRS.Simple`).
   * @param {string} nextMode - "OSM" | "STATIC_IMAGE"
   */
  switchMapMode(nextMode) {
    if (nextMode === this.mapMode) return;
    this.mapMode = nextMode;

    // Destroy existing map instance to cleanly reconfigure CRS
    if (this.map) {
      this.map.remove();
      this.markerMap.clear();
      this.civicMarkerMap.clear();
      this.userLocationMarker = null;
    }

    if (nextMode === "STATIC_IMAGE") {
      // SELF-CONTAINED STATIC DISTRICT MAP COORDINATE SYSTEM (`L.CRS.Simple`)
      this.map = L.map(this.containerId, {
        crs: L.CRS.Simple,
        minZoom: -1,
        maxZoom: 3,
        zoomControl: true,
        attributionControl: true
      });

      this.imageOverlay = L.imageOverlay("./assets/images/district-map-static.svg", STATIC_BOUNDS).addTo(this.map);
      this.map.setView(STATIC_CENTER, 0);

      this.markerLayer = L.layerGroup().addTo(this.map);
      this.civicLayer = L.layerGroup().addTo(this.map);

      this.map.on("click", (event) => this.handleMapClick(event));
      console.log("🖼️ [MapController] Activated Self-Contained Static District Map Coordinate System (L.CRS.Simple: 0..1000).");
    } else {
      // STANDARD LIVE OSM GEOGRAPHICAL MODE
      this.init();
    }
  }

  /**
   * Handle user clicks on the map surface.
   * @param {L.LeafletMouseEvent} event
   */
  handleMapClick(event) {
    if (!this.isReportingMode) {
      return;
    }

    let { lat, lng } = event.latlng;
    
    // In Static Map Mode, coordinates are Cartesian (Y, X) within 0..1000
    if (this.mapMode === "STATIC_IMAGE") {
      lat = Math.min(Math.max(Math.round(lat), 0), 1000);
      lng = Math.min(Math.max(Math.round(lng), 0), 1000);
    }

    this.setDraftMarker(lat, lng);

    if (typeof this.onReportClick === "function") {
      this.onReportClick(lat, lng, this.mapMode);
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
      iconSize: [36, 36],
      iconAnchor: [18, 36]
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
   * Only active in OSM Geographical Mode.
   *
   * @param {Function} onSuccess
   * @param {Function} onError
   */
  locateUserDistrict(onSuccess, onError) {
    if (this.mapMode === "STATIC_IMAGE") {
      this.map.setView(STATIC_CENTER, 0, { animate: true });
      if (onSuccess) onSuccess({ latitude: 500, longitude: 500, mode: "STATIC_IMAGE" });
      return;
    }

    if (!navigator.geolocation) {
      if (onError) onError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        this.map.setView([latitude, longitude], 15, { animate: true });

        if (this.userLocationMarker) {
          this.userLocationMarker.setLatLng([latitude, longitude]);
        } else {
          const userIcon = L.divIcon({
            className: "user-location-pin",
            html: `
              <div style="
                width: 20px;
                height: 20px;
                background: #0d47a1;
                border: 3px solid #ffffff;
                border-radius: 50%;
                box-shadow: 0 0 0 6px rgba(13, 71, 161, 0.3);
              " title="Your Current Position"></div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          this.userLocationMarker = L.marker([latitude, longitude], { 
            icon: userIcon,
            zIndexOffset: 1000
          })
            .addTo(this.map)
            .bindTooltip("📍 You Are Here (My Location)", { direction: "top", offset: [0, -10] });
        }

        if (onSuccess) onSuccess({ latitude, longitude });
      },
      (error) => {
        console.warn("Geolocation permission denied or unavailable:", error.message);
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
    this.map.setView([lat, lng], this.mapMode === "STATIC_IMAGE" ? 1 : 17, { animate: true });

    const marker = this.markerMap.get(reportId);
    if (marker) {
      marker.openPopup();
    }
  }

  /**
   * Smoothly pan and zoom to a Government / Civic Office and open its popup.
   * @param {number} lat
   * @param {number} lng
   * @param {string} officeId
   */
  focusOnCivicOffice(lat, lng, officeId) {
    this.map.setView([lat, lng], this.mapMode === "STATIC_IMAGE" ? 1 : 17, { animate: true });

    const marker = this.civicMarkerMap.get(officeId);
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
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -32]
    });
  }

  /**
   * Build HTML content for the Leaflet Popup attached to each barrier marker.
   * @param {Object} report
   * @returns {string} HTML string
   */
  buildPopupHTML(report) {
    const meta = CATEGORY_META[report.category] || CATEGORY_META.OTHER;
    const statusText = report.status === "RESOLVED" ? "✔ RESOLVED" : `🔴 ${report.severity || 'MEDIUM'}`;
    const safeTitle = escapeHTML(report.title);
    const safeDesc = escapeHTML(
      report.description.length > 90 
        ? report.description.substring(0, 90) + "..." 
        : report.description
    );

    return `
      <div class="popup-card" role="region" aria-label="Barrier report popup: ${safeTitle}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-size:0.78rem; font-weight:800; color:#0d47a1;">${meta.icon} ${meta.label}</span>
          <span style="font-size:0.72rem; font-weight:800; color:#475569;">${statusText}</span>
        </div>
        <h4 class="popup-title">${safeTitle}</h4>
        <p class="popup-desc">${safeDesc}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#475569; margin-top:4px;">
          <span>👍 ${report.upvotes || 1} confirmations</span>
        </div>
        <button type="button" class="btn btn-sm btn-primary popup-btn" 
                onclick="window.dispatchEvent(new CustomEvent('open-report-details', { detail: '${report.id}' }))"
                aria-label="View full details for barrier report: ${safeTitle}">
          View Full Details
        </button>
      </div>
    `;
  }

  /**
   * Synchronize Leaflet map markers with the filtered reports array.
   * Maps WGS84 coordinates in OSM mode or Cartesian (Y, X) coordinates in Static Map Mode.
   *
   * @param {Array<Object>} filteredReports
   */
  syncMarkers(filteredReports) {
    const activeIds = new Set();

    for (const report of filteredReports) {
      activeIds.add(report.id);

      // Determine map coordinate based on current mapMode
      const lat = this.mapMode === "STATIC_IMAGE" ? (report.staticY || 500) : report.lat;
      const lng = this.mapMode === "STATIC_IMAGE" ? (report.staticX || 500) : report.lng;

      const existingMarker = this.markerMap.get(report.id);
      const icon = this.buildPinIcon(report);
      const popupHtml = this.buildPopupHTML(report);
      const meta = CATEGORY_META[report.category] || CATEGORY_META.OTHER;
      const safeTitle = escapeHTML(report.title);
      const ariaText = `Barrier Pin: ${safeTitle}, Category: ${meta.label}, Urgency: ${report.severity || 'MEDIUM'}, Status: ${report.status || 'OPEN'}. Press Enter or Space to open details popup.`;

      if (existingMarker) {
        existingMarker.setLatLng([lat, lng]);
        existingMarker.setIcon(icon);
        existingMarker.setPopupContent(popupHtml);
        const el = existingMarker.getElement();
        if (el) el.setAttribute("aria-label", ariaText);
      } else {
        const newMarker = L.marker([lat, lng], {
          icon: icon,
          title: report.title,
          alt: ariaText
        });

        newMarker.bindPopup(popupHtml, {
          closeButton: true,
          autoPan: true
        });

        newMarker.on("add", () => {
          const el = newMarker.getElement();
          if (el) {
            el.setAttribute("role", "button");
            el.setAttribute("tabindex", "0");
            el.setAttribute("aria-label", ariaText);
            el.addEventListener("keydown", (evt) => {
              if (evt.key === "Enter" || evt.key === " ") {
                evt.preventDefault();
                newMarker.openPopup();
              }
            });
          }
        });

        this.markerLayer.addLayer(newMarker);
        this.markerMap.set(report.id, newMarker);
      }
    }

    for (const [id, marker] of this.markerMap.entries()) {
      if (!activeIds.has(id)) {
        this.markerLayer.removeLayer(marker);
        this.markerMap.delete(id);
      }
    }
  }

  /**
   * Render official municipal and congressional offices on the map with a
   * green 'Verified Accessible' badge (`🏛️`).
   *
   * @param {Array<Object>} civicOffices
   * @param {boolean} [visible=true]
   */
  syncCivicOffices(civicOffices, visible = true) {
    if (!visible) {
      this.civicLayer.clearLayers();
      this.civicMarkerMap.clear();
      return;
    }

    const activeIds = new Set();

    for (const office of civicOffices) {
      activeIds.add(office.id);

      const lat = this.mapMode === "STATIC_IMAGE" ? (office.staticY || 500) : office.lat;
      const lng = this.mapMode === "STATIC_IMAGE" ? (office.staticX || 500) : office.lng;

      const existingMarker = this.civicMarkerMap.get(office.id);
      const safeName = escapeHTML(office.name);
      const safeAddress = escapeHTML(office.address);
      const safePhone = escapeHTML(office.phone);
      const safeServices = escapeHTML(office.services);
      const ariaText = `Verified Government Office Pin: ${safeName}, Type: ${office.type}. Press Enter or Space to open office accessibility profile.`;

      const icon = L.divIcon({
        className: "civic-pin-container",
        html: `
          <div class="custom-pin-icon" style="
            background: #047857;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 10px rgba(4, 120, 87, 0.4);
          " title="${safeName} (Verified Accessible)" role="img" aria-label="${safeName}">
            🏛️
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -34]
      });

      const featuresList = (office.adaFeatures || [])
        .map((f) => `<span style="background:#ecfdf5; color:#047857; padding:2px 6px; border-radius:4px; font-size:0.68rem; font-weight:700;">✔ ${escapeHTML(f)}</span>`)
        .join(" ");

      const popupHtml = `
        <div class="popup-card" role="region" aria-label="Government office popup: ${safeName}">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:0.72rem; font-weight:800; color:#047857; background:#ecfdf5; padding:2px 8px; border-radius:10px;">
              🏛️ VERIFIED ACCESSIBLE
            </span>
            <span style="font-size:0.7rem; font-weight:700; color:#475569;">${escapeHTML(office.type)}</span>
          </div>
          <h4 class="popup-title">${safeName}</h4>
          <p class="popup-desc" style="margin-bottom:6px;">
            <strong>Address:</strong> ${safeAddress}<br>
            <strong>Phone:</strong> ${safePhone}<br>
            <strong>Services:</strong> ${safeServices}
          </p>
          <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;">
            ${featuresList}
          </div>
          <button type="button" class="btn btn-sm btn-success popup-btn"
                  onclick="window.dispatchEvent(new CustomEvent('open-civic-details', { detail: '${office.id}' }))"
                  aria-label="View office and accessibility profile for ${safeName}">
            View Office &amp; Accessibility Profile
          </button>
        </div>
      `;

      if (existingMarker) {
        existingMarker.setLatLng([lat, lng]);
        existingMarker.setIcon(icon);
        existingMarker.setPopupContent(popupHtml);
        const el = existingMarker.getElement();
        if (el) el.setAttribute("aria-label", ariaText);
      } else {
        const newMarker = L.marker([lat, lng], {
          icon: icon,
          title: office.name,
          zIndexOffset: 500,
          alt: ariaText
        });

        newMarker.bindPopup(popupHtml, {
          closeButton: true,
          autoPan: true
        });

        newMarker.on("add", () => {
          const el = newMarker.getElement();
          if (el) {
            el.setAttribute("role", "button");
            el.setAttribute("tabindex", "0");
            el.setAttribute("aria-label", ariaText);
            el.addEventListener("keydown", (evt) => {
              if (evt.key === "Enter" || evt.key === " ") {
                evt.preventDefault();
                newMarker.openPopup();
              }
            });
          }
        });

        this.civicLayer.addLayer(newMarker);
        this.civicMarkerMap.set(office.id, newMarker);
      }
    }

    for (const [id, marker] of this.civicMarkerMap.entries()) {
      if (!activeIds.has(id)) {
        this.civicLayer.removeLayer(marker);
        this.civicMarkerMap.delete(id);
      }
    }
  }
}

export { CATEGORY_META };
