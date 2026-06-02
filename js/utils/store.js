/* =============================================================
   Mango · utils/store.js
   -------------------------------------------------------------
   Session + theme state, persisted in localStorage.
   The single source of truth for "who is logged in".
   ============================================================= */

window.App = window.App || {};

App.store = (function () {
  const cfg = App.config;

  /* ---- Session ---- */
  function setSession(token, user) {
    localStorage.setItem(cfg.TOKEN_KEY, token);
    localStorage.setItem(cfg.USER_KEY, JSON.stringify(user));
  }
  function clearSession() {
    localStorage.removeItem(cfg.TOKEN_KEY);
    localStorage.removeItem(cfg.USER_KEY);
  }
  function currentUser() {
    try { return JSON.parse(localStorage.getItem(cfg.USER_KEY)); }
    catch (e) { return null; }
  }
  function isAuthed() { return !!localStorage.getItem(cfg.TOKEN_KEY) && !!currentUser(); }
  function role() { const u = currentUser(); return u ? u.role : null; }
  function patchUser(patch) {
    const u = currentUser(); if (!u) return;
    localStorage.setItem(cfg.USER_KEY, JSON.stringify({ ...u, ...patch }));
  }

  /* ---- Theme ---- */
  function initTheme() {
    let t = localStorage.getItem(cfg.THEME_KEY);
    if (!t) t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(t);
  }
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem(cfg.THEME_KEY, t);
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: t } }));
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(cur === "dark" ? "light" : "dark");
  }
  function theme() { return document.documentElement.getAttribute("data-theme") || "light"; }

  return { setSession, clearSession, currentUser, isAuthed, role, patchUser, initTheme, toggleTheme, theme };
})();
