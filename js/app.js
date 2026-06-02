/* =============================================================
   Mango · app.js — bootstrap
   -------------------------------------------------------------
   Applies the saved theme, exposes global actions (logout) and
   starts the router once the DOM is ready.
   ============================================================= */

window.App = window.App || {};
App.scratch = App.scratch || {}; // transient cross-view data (e.g. ticket prefill)

App.actions = {
  logout() {
    App.store.clearSession();
    App.toast.info("Cerraste sesión.");
    App.router.go("#/login");
    App.router.render();
  },
};

document.addEventListener("DOMContentLoaded", function () {
  App.store.initTheme();

  // keep charts in sync when the theme changes while a chart view is open
  document.addEventListener("themechange", function () {
    const hash = location.hash;
    if (hash.indexOf("#/dashboard") === 0) App.router.render();
  });

  App.router.start();
});
