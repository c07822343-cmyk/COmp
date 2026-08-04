/**
 * ============================================================================
 * ACCESSYOURDISTRICT - DISTRICT CONFIGURATION & DYNAMIC HEADER SERVICE
 * Congressional App Challenge - Civic Inclusion & Constituent Portal
 * ============================================================================
 *
 * FRONT-END ARCHITECTURE & CIVIC BRANDING EXPLANATION:
 * ----------------------------------------------------
 * 1. Dynamic District Header (JSON-Driven Architecture):
 *    - The `districtConfig` JSON object stores the Congressional District code,
 *      Representative's name, office location, phone, and official House.gov URL.
 *    - `renderDistrictHeader(config)` binds this JSON object to the DOM on page
 *      load, allowing any student from any of the 435 U.S. Congressional Districts
 *      to customize the app for their representative simply by updating this file.
 *
 * 2. Civic Engagement Commitment (Official House.gov Links):
 *    - Links directly to the Member's official House.gov contact website so
 *      constituents can share accessibility barrier reports with caseworkers.
 *
 * 3. Congressional Seal & Branding Aesthetic:
 *    - Incorporates official Congressional navy blue (`#002868`), American gold
 *      emblems (`#d4af37`), and star motifs (`★★★`) to align with the dignity
 *      and authority of federal congressional programs.
 * ============================================================================
 */

export const districtConfig = {
  districtName: "Florida's 23rd Congressional District",
  districtCode: "FL-23",
  representative: {
    name: "Rep. Jared Moskowitz",
    title: "U.S. Representative",
    officeLocation: "Boca Raton & Fort Lauderdale District Offices",
    phone: "(954) 845-1179",
    phoneClean: "9548451179",
    website: "https://moskowitz.house.gov",
    contactUrl: "https://moskowitz.house.gov/contact",
    sealText: "FL-23",
    tagline: "119th U.S. Congress • Constituent Accessibility & ADA Initiative"
  }
};

/**
 * Dynamically populates the Congressional District Header banner and contact links
 * using the provided JSON configuration object.
 *
 * @param {Object} [config=districtConfig] - District configuration JSON object
 */
export function renderDistrictHeader(config = districtConfig) {
  if (!config || !config.representative) {
    console.warn("⚠️ [DistrictConfig] Invalid configuration object provided.");
    return;
  }

  const { districtName, districtCode, representative: rep } = config;

  // 1. Update Seal Badge Code
  const sealEl = document.getElementById("district-seal-code");
  if (sealEl) sealEl.textContent = rep.sealText || districtCode;

  // 2. Update Tagline
  const taglineEl = document.getElementById("district-tagline");
  if (taglineEl) taglineEl.textContent = rep.tagline;

  // 3. Update Representative Name & District Name
  const nameEl = document.getElementById("rep-name-display");
  if (nameEl) nameEl.textContent = rep.name;

  const districtEl = document.getElementById("district-name-display");
  if (districtEl) districtEl.textContent = districtName;

  // 4. Update Office Location & Phone
  const officeEl = document.getElementById("rep-office-display");
  if (officeEl) officeEl.textContent = rep.officeLocation;

  const phoneEl = document.getElementById("rep-phone-display");
  if (phoneEl) {
    phoneEl.textContent = rep.phone;
    phoneEl.setAttribute("href", `tel:${rep.phoneClean || rep.phone.replace(/[^0-9]/g, '')}`);
  }

  // 5. Update Official House.gov Contact Representative Button
  const btnContact = document.getElementById("btn-contact-rep");
  if (btnContact && rep.contactUrl) {
    btnContact.setAttribute("href", rep.contactUrl);
    btnContact.setAttribute(
      "aria-label",
      `Contact ${rep.name} on official House.gov website (opens in new tab)`
    );
  }

  // 6. Also update any sidebar civic directory header references if present
  const civicDirSubtitle = document.getElementById("rep-sidebar-contact-info");
  if (civicDirSubtitle) {
    civicDirSubtitle.innerHTML = `
      Official Constituent Office: <strong>${rep.name}</strong> (${districtCode}) &bull; 
      <a href="${rep.contactUrl}" target="_blank" rel="noopener noreferrer" class="civic-rep-link">${rep.website}</a>
    `;
  }

  console.log(`✅ [DistrictHeader] Successfully rendered district header for: ${rep.name} (${districtCode}).`);
}
