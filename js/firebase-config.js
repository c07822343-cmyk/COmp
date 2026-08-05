/**
 * ============================================================================
 * ACCESSYOURDISTRICT - STORAGE ENGINE CONFIGURATION
 * Congressional App Challenge - Civic Inclusion Platform
 * ============================================================================
 *
 * SENIOR WEB DEVELOPER ARCHITECTURE NOTE:
 * ---------------------------------------
 * 1. Removal of Firebase Dependencies:
 *    - To make this application 100% self-contained and operable without
 *      external database credentials or network connections, all Firebase
 *      Realtime Database dependencies ('push', 'onValue') have been replaced
 *      with the browser's Web Storage API (localStorage).
 *
 * 2. Why Web Storage API (localStorage)?
 *    - User-created map markers and descriptions are serialized into a local
 *      JSON string and saved on the user's browser.
 *    - Every time the application is opened, `loadReportsFromStorage()`
 *      retrieves and parses the JSON string so personal reports remain persistent.
 * ============================================================================
 */

export const isLiveFirebaseConfigured = false;
export const USE_WEB_STORAGE_API = true;

// Clean placeholder exports so existing module signatures resolve without Firebase CDN
export const db = null;
export const ref = () => null;
export const push = async () => null;
export const set = async () => null;
export const update = async () => null;
export const onValue = () => null;
