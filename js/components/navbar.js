/* =============================================================
   Mango · components/navbar.js
   -------------------------------------------------------------
   Role-aware top navigation. Links differ for "user" vs
   "advisor". Includes theme toggle + user menu (profile,
   logout). Re-rendered by the router on every navigation so
   the active link stays in sync with the hash.
   ============================================================= */

window.App = window.App || {};

App.navbar = (function () {
  const { icon, esc } = App.dom;

  /* Nav definitions per role. */
  const LINKS = {
    user: [
      { href: "#/dashboard", label: "Resumen",  icon: "grid" },
      { href: "#/gastos",    label: "Gastos",    icon: "list" },
      { href: "#/nuevo",     label: "Cargar",    icon: "plus" },
      { href: "#/ticket",    label: "Ticket",    icon: "camera" },
    ],
    advisor: [
      { href: "#/asesor",    label: "Clientes",  icon: "users" },
    ],
  };

  function render(activeHash) {
    const user = App.store.currentUser();
    if (!user) return "";
    const links = LINKS[user.role] || [];
    const isDark = App.store.theme() === "dark";

    const linkHtml = links.map((l) => {
      const active = activeHash.indexOf(l.href) === 0 ? " active" : "";
      return '<a class="nav-link' + active + '" href="' + l.href + '">' + icon(l.icon) + "<span>" + l.label + "</span></a>";
    }).join("");

    const homeHref = user.role === "advisor" ? "#/asesor" : "#/dashboard";

    return (
      '<nav class="navbar"><div class="shell">' +
        '<a class="brand" href="' + homeHref + '">' +
          '<span class="logo">' + icon("wallet") + "</span>" +
          "<span class=\"word\">Man<b>go</b></span>" +
        "</a>" +
        '<button class="icon-btn nav-burger" id="navBurger" aria-label="Menú">' + icon("menu") + "</button>" +
        '<div class="nav-links" id="navLinks">' + linkHtml + "</div>" +
        '<div class="nav-right">' +
          '<button class="theme-toggle" id="themeToggle" aria-label="Cambiar tema">' + icon(isDark ? "sun" : "moon") + "</button>" +
          '<div class="user-menu">' +
            '<button class="user-menu-btn" id="userMenuBtn" aria-haspopup="true" aria-expanded="false">' +
              '<span class="avatar">' + esc(App.format.initials(user.name)) + "</span>" +
              '<span class="who"><strong>' + esc(user.name.split(" ")[0]) + "</strong>" +
                '<span>' + (user.role === "advisor" ? "Asesor" : "Mi cuenta") + "</span></span>" +
            "</button>" +
          "</div>" +
        "</div>" +
      "</div></nav>"
    );
  }

  /* Attach behaviour after the navbar HTML is in the DOM. */
  function bind(rootEl) {
    const { $ } = App.dom;
    const burger = $("#navBurger", rootEl);
    const links = $("#navLinks", rootEl);
    if (burger && links) burger.addEventListener("click", () => links.classList.toggle("open"));

    const themeBtn = $("#themeToggle", rootEl);
    if (themeBtn) themeBtn.addEventListener("click", () => { App.store.toggleTheme(); App.router.refreshChrome(); });

    const menuBtn = $("#userMenuBtn", rootEl);
    if (menuBtn) menuBtn.addEventListener("click", (e) => { e.stopPropagation(); openUserMenu(menuBtn); });
  }

  function openUserMenu(btn) {
    const existing = document.querySelector(".menu-pop");
    if (existing) { existing.remove(); return; }
    const user = App.store.currentUser();
    const pop = document.createElement("div");
    pop.className = "menu-pop";
    const profile = user.role === "user"
      ? '<a href="#/perfil">' + icon("user") + "Mi perfil</a>"
      : "";
    pop.innerHTML =
      '<div style="padding:8px 12px 4px"><strong style="font-size:13px">' + esc(user.name) + "</strong>" +
        '<div style="font-size:12px;color:var(--text-faint)">' + esc(user.email) + "</div></div><hr>" +
      profile +
      '<button class="danger-item" id="logoutBtn">' + icon("logout") + "Cerrar sesión</button>";
    btn.parentElement.appendChild(pop);

    const close = () => { pop.remove(); document.removeEventListener("click", close); };
    setTimeout(() => document.addEventListener("click", close), 0);
    pop.querySelector("#logoutBtn").addEventListener("click", () => { close(); App.actions.logout(); });
  }

  return { render, bind };
})();
