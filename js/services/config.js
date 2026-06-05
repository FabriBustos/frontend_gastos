/* =============================================================
   Mango · config.js
   -------------------------------------------------------------
   Single switch between MOCK data and a real REST backend.
   Flip USE_MOCK to false and set API_BASE_URL to point the
   whole app at the production API — no other file changes.
   ============================================================= */

window.App = window.App || {};

App.config = {
  /* When true, api.js resolves every request against in-memory
     mock data (see mockData.js). When false, it performs real
     fetch() calls to API_BASE_URL. */
  USE_MOCK: false,

  /* Base URL of the real REST API (used only when USE_MOCK = false). */
API_BASE_URL: "https://backendgastos-production.up.railway.app",

  /* localStorage keys */
  TOKEN_KEY: "mango.token",
  USER_KEY: "mango.user",
  THEME_KEY: "mango.theme",

  /* Simulated network latency for the mock layer (ms) */
  MOCK_LATENCY: 550,

  /* App metadata */
  CURRENCY: "ARS",
  LOCALE: "es-AR",
};
