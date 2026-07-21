/* =============================================================
   Mango · components/navbar.js
   -------------------------------------------------------------
   Role-aware top navigation. Links differ for "user" vs
   "advisor". Includes theme toggle + user menu (profile,
   logout). Re-rendered by the router on every navigation so
   the active link stays in sync with the hash.

   Advisor extra: notification bell that shows the count of
   open (unanswered) consultations and a popup list.
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
      { href: "#/consultas", label: "Consultas", icon: "sparkle" },
      { href: "#/presupuestos", label: "Presupuestos", icon: "wallet" },
      { href: "#/metas", label: "Metas", icon: "target" },
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
          (user.role === "advisor"
            ? '<div class="user-menu" style="position:relative">' +
                '<button class="notif-btn" id="notifBtn" aria-label="Consultas pendientes">' +
                  icon("bell") +
                  '<span class="notif-badge" id="notifBadge"></span>' +
                "</button>" +
              "</div>"
            : "") +
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

    const notifBtn = $("#notifBtn", rootEl);
    if (notifBtn) {
      // Cargar el conteo de consultas pendientes al montar el navbar
      loadNotifCount(notifBtn);
      notifBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openNotifPop(notifBtn);
      });
    }
  }

  async function loadNotifCount(btn) {
    if (!btn) return;
    const badge = btn.querySelector("#notifBadge") || btn.querySelector(".notif-badge");
    try {
      const all = await App.api.getAllConsultations();
      const pending = all.filter((c) => !c.answer).length;
      if (badge) {
        badge.textContent = pending > 9 ? "9+" : String(pending);
        badge.classList.toggle("visible", pending > 0);
      }
    } catch (e) {
      // Si falla silenciosamente (p.ej. en modo mock sin consultas), no mostrar badge
    }
  }

  function openNotifPop(btn) {
    const F = App.format;
    // Cerrar si ya está abierto
    const existing = document.querySelector(".notif-pop");
    if (existing) { existing.remove(); return; }

    const pop = document.createElement("div");
    pop.className = "notif-pop";
    pop.innerHTML =
      '<div class="notif-pop-head"><span>Consultas pendientes</span>' +
        '<a href="#/asesor">Ver clientes</a>' +
      "</div>" +
      '<div class="notif-list" id="notifList"><div class="notif-empty">Cargando…</div></div>';

    btn.parentElement.appendChild(pop);

    const close = () => { pop.remove(); document.removeEventListener("click", close); };
    setTimeout(() => document.addEventListener("click", close), 0);
    pop.addEventListener("click", (e) => e.stopPropagation());

    // Cargar consultas
    App.api.getAllConsultations().then((all) => {
      const pending = all.filter((c) => !c.answer);
      const list = pop.querySelector("#notifList");
      if (!list) return;
      if (!pending.length) {
        list.innerHTML = '<div class="notif-empty">No hay consultas pendientes 🎉</div>';
        return;
      }
      list.innerHTML = pending.slice(0, 8).map((c) => {
        const name = c.user ? esc(c.user.name) : "Cliente";
        const q = esc(c.question.length > 60 ? c.question.slice(0, 60) + "…" : c.question);
        const date = F.date(c.createdAt.slice(0, 10));
        return '<div class="notif-item">' +
          '<div class="ni-ico">' + icon("sparkle") + "</div>" +
          '<div class="ni-body">' +
            '<div class="ni-name">' + name + "</div>" +
            '<div class="ni-q">' + q + "</div>" +
            '<div class="ni-date">' + date + "</div>" +
          "</div>" +
        "</div>";
      }).join("");
      if (pending.length > 8) {
        list.innerHTML += '<div class="notif-empty" style="padding:var(--sp-3)">+' + (pending.length - 8) + " consultas más</div>";
      }
    }).catch(() => {
      const list = pop.querySelector("#notifList");
      if (list) list.innerHTML = '<div class="notif-empty">No se pudieron cargar.</div>';
    });
  }

  function openUserMenu(btn) {
    const existing = document.querySelector(".menu-pop");
    if (existing) { existing.remove(); return; }
    const user = App.store.currentUser();
    const pop = document.createElement("div");
    pop.className = "menu-pop";
    const profile = (user.role === "user" || user.role === "advisor")
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

  return { render, bind, loadNotifCount };
})();
