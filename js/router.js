/* =============================================================
   Mango · router.js — hash router + route guards
   -------------------------------------------------------------
   • Maps #/path to a view function in App.views.
   • Guards: unauthenticated users are sent to #/login;
     authenticated users hitting an auth page are sent home;
     advisor-only routes are blocked for regular users (and
     vice-versa).
   • Renders the role-aware navbar (chrome) around each view.
   ============================================================= */

window.App = window.App || {};

App.router = (function () {
  const { $ } = App.dom;

  /* route table: path -> view name, allowed roles, chrome on/off */
  const ROUTES = {
    "/login":     { view: "login",     public: true,  chrome: false },
    "/register":  { view: "register",  public: true,  chrome: false },
    "/dashboard": { view: "dashboard", roles: ["user"],    chrome: true },
    "/gastos":    { view: "gastos",    roles: ["user"],    chrome: true },
    "/nuevo":     { view: "nuevo",     roles: ["user"],    chrome: true },
    "/ticket":    { view: "ticket",    roles: ["user"],    chrome: true },
    "/perfil":    { view: "perfil",    roles: ["user", "advisor"], chrome: true },
    "/asesor":    { view: "asesor",    roles: ["advisor"], chrome: true },
    "/consultas": { view: "consultas", roles: ["user"], chrome: true },
    "/presupuestos": { view: "presupuestos", roles: ["user"], chrome: true },
    "/metas": { view: "metas", roles: ["user"], chrome: true },
  };

  function homeFor(role) { return role === "advisor" ? "#/asesor" : "#/dashboard"; }

  /* Parse the current hash into { path, params }. */
  function parse() {
    const raw = (location.hash || "#/login").slice(1); // "/asesor/u1"
    const seg = raw.split("/").filter(Boolean);        // ["asesor","u1"]
    const base = "/" + (seg[0] || "");
    const params = {};
    if (base === "/asesor" && seg[1]) params.id = seg[1];
    return { path: base, params, raw };
  }

  let busy = false;

  async function render() {
    const { path, params } = parse();
    const route = ROUTES[path];
    const authed = App.store.isAuthed();
    const role = App.store.role();

    // unknown route
    if (!route) { return go(authed ? homeFor(role) : "#/login", true); }

    // guard: auth required
    if (!route.public && !authed) {
      App.toast.warning("Iniciá sesión para continuar.");
      return go("#/login", true);
    }
    // guard: already authed shouldn't see login/register
    if (route.public && authed) { return go(homeFor(role), true); }

    // guard: role mismatch
    if (route.roles && authed && route.roles.indexOf(role) === -1) {
      App.toast.error("No tenés acceso a esa sección.", "Acceso denegado");
      return go(homeFor(role), true);
    }

    const root = $("#app");

    if (route.chrome) {
      // render navbar + page container (reuse if same chrome already present)
      root.innerHTML =
        App.navbar.render("#" + (parse().raw)) +
        '<main class="page"><div class="shell" id="view"></div></main>';
      App.navbar.bind(root);
    } else {
      root.innerHTML = '<div id="view"></div>';
    }

    const viewEl = $("#view", root);
    const viewFn = App.views[route.view];
    if (typeof viewFn !== "function") {
      viewEl.innerHTML = "<p>Vista no encontrada.</p>";
      return;
    }
    try {
      await viewFn(viewEl, params);
    } catch (err) {
      console.error("[view error]", err);
      viewEl.innerHTML = '<div class="empty"><p>Ocurrió un error al cargar la vista.</p></div>';
      App.toast.error("Error inesperado.", "Ups");
    }
    window.scrollTo(0, 0);
  }

  /* Re-render just the chrome (navbar) — e.g. after theme/profile change. */
  function refreshChrome() {
    const root = $("#app");
    if (!root.querySelector(".navbar")) return;
    // re-render navbar in place, keep the current view DOM
    const view = $("#view", root);
    const detached = view; // keep reference
    const nav = App.navbar.render(location.hash);
    const navEl = root.querySelector(".navbar");
    const tmp = document.createElement("div");
    tmp.innerHTML = nav;
    navEl.replaceWith(tmp.firstChild);
    App.navbar.bind(root);
  }

  /* Navigate. replace=true updates hash without pushing history dup. */
  function go(hash, silent) {
    if (location.hash === hash) { if (!silent) render(); return; }
    if (silent) { history.replaceState(null, "", hash); }
    else { location.hash = hash; }
    if (silent) render();
  }

  /* Update the hash WITHOUT triggering a re-render (used when a
     view manages its own internal state, e.g. advisor selecting
     a client). hashchange won't fire because we set it via
     replaceState. */
  let suppress = false;
  function replaceHash(hash) {
    suppress = true;
    history.replaceState(null, "", hash);
    setTimeout(() => (suppress = false), 0);
  }

  function start() {
    window.addEventListener("hashchange", () => { if (!suppress) render(); });
    render();
  }

  return { start, render, go, refreshChrome, parse, homeFor, replaceHash };
})();
