/* =============================================================
   Mango · views/auth.js — Login (#/login) & Registro (#/register)
   -------------------------------------------------------------
   Full-screen split layout (no navbar). Client-side validation
   via App.validate; on success stores the JWT + user and routes
   to the role's home.
   ============================================================= */

window.App = window.App || {};
App.views = App.views || {};

(function () {
  const { icon, esc, $ } = App.dom;
  const V = App.validate;

  /* Branded marketing aside shared by both screens. */
  function aside() {
    return (
      '<aside class="auth-aside">' +
        '<a class="brand" href="#/login"><span class="logo">' + icon("wallet") + "</span><span class=\"word\">Man<b>go</b></span></a>" +
        '<div class="auth-pitch">' +
          "<h1>Tus gastos, en claro.</h1>" +
          "<p>La forma simple de registrar, entender y mejorar en qué se te va la plata cada mes.</p>" +
        "</div>" +
        '<div class="auth-feats">' +
          feat("trend", "Gráficos de tus gastos en tiempo real") +
          feat("camera", "Cargá un ticket y la IA completa el resto") +
          feat("target", "Recomendaciones de un asesor financiero") +
        "</div>" +
      "</aside>"
    );
  }
  function feat(ic, label) {
    return '<div class="auth-feat"><span class="tick">' + icon(ic) + "</span><span>" + esc(label) + "</span></div>";
  }

  function themeMini() {
    const isDark = App.store.theme() === "dark";
    return '<button class="theme-toggle" id="authTheme" aria-label="Cambiar tema">' + icon(isDark ? "sun" : "moon") + "</button>";
  }

  /* ---------------- LOGIN ---------------- */
  App.views.login = async function (container) {
    container.innerHTML =
      '<div class="auth">' + aside() +
        '<main class="auth-main"><div class="auth-card">' +
          '<div class="top-toggle">' + themeMini() + "</div>" +
          "<h2>Bienvenido de nuevo</h2>" +
          '<p class="sub">Ingresá para ver el resumen de tus gastos.</p>' +
          '<form id="loginForm" novalidate>' +
            field("email", "Email", '<input class="input" type="email" id="li-email" placeholder="tu@email.com" autocomplete="username">') +
            field("password", "Contraseña", '<input class="input" type="password" id="li-pass" placeholder="••••••••" autocomplete="current-password">') +
            '<button class="btn btn-primary btn-block btn-lg" type="submit" id="loginBtn">Ingresar</button>' +
          "</form>" +
          '<p class="auth-switch">¿No tenés cuenta? <a href="#/register">Creá una gratis</a></p>' +
          '<div class="demo-note"><b>Cuentas de prueba</b>' +
            '<div class="dn-row">Usuario: <code>juan@mango.app</code></div>' +
            '<div class="dn-row">Asesor: <code>asesor@mango.app</code></div>' +
            '<div class="dn-row">Contraseña (ambas): <code>123456</code></div>' +
          "</div>" +
        "</div></main>" +
      "</div>";

    bindTheme(container);
    const form = $("#loginForm", container);
    const fEmail = form.querySelector('[data-f="email"]');
    const fPass = form.querySelector('[data-f="password"]');

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#li-email").value, pass = $("#li-pass").value;
      const ok = V.form({
        email: { el: fEmail, value: email, rules: [V.rules.required, V.rules.email] },
        password: { el: fPass, value: pass, rules: [V.rules.required] },
      });
      if (!ok) return;

      const btn = $("#loginBtn");
      setLoading(btn, true, "Ingresando");
      try {
        const { token, user } = await App.api.login(email, pass);
        App.store.setSession(token, user);
        App.toast.success("¡Hola de nuevo, " + user.name.split(" ")[0] + "!");
        App.router.go(user.role === "advisor" ? "#/asesor" : "#/dashboard");
      } catch (err) {
        setLoading(btn, false);
        App.toast.error(err.message || "No se pudo iniciar sesión.", "Error");
      }
    });
  };

  /* ---------------- REGISTER ---------------- */
  App.views.register = async function (container) {
    container.innerHTML =
      '<div class="auth">' + aside() +
        '<main class="auth-main"><div class="auth-card">' +
          '<div class="top-toggle">' + themeMini() + "</div>" +
          "<h2>Creá tu cuenta</h2>" +
          '<p class="sub">Empezá a controlar tus gastos en menos de un minuto.</p>' +
          '<form id="regForm" novalidate>' +
            field("name", "Nombre completo", '<input class="input" type="text" id="rg-name" placeholder="Juan Pérez" autocomplete="name">') +
            field("email", "Email", '<input class="input" type="email" id="rg-email" placeholder="tu@email.com" autocomplete="email">') +
            field("password", "Contraseña",
              '<input class="input" type="password" id="rg-pass" placeholder="Mínimo 6 caracteres" autocomplete="new-password">' +
              '<div class="pw-meter"><span id="pwBar"></span></div>') +
            field("confirm", "Repetir contraseña", '<input class="input" type="password" id="rg-pass2" placeholder="••••••••" autocomplete="new-password">') +
            '<button class="btn btn-primary btn-block btn-lg" type="submit" id="regBtn">Crear cuenta</button>' +
          "</form>" +
          '<p class="auth-switch">¿Ya tenés cuenta? <a href="#/login">Ingresá</a></p>' +
        "</div></main>" +
      "</div>";

    bindTheme(container);
    const form = $("#regForm", container);
    const fName = form.querySelector('[data-f="name"]');
    const fEmail = form.querySelector('[data-f="email"]');
    const fPass = form.querySelector('[data-f="password"]');
    const fConf = form.querySelector('[data-f="confirm"]');
    const pass = $("#rg-pass", container);
    const bar = $("#pwBar", container);

    const COLORS = ["var(--danger)", "var(--danger)", "var(--warning)", "var(--primary)", "var(--primary)"];
    pass.addEventListener("input", () => {
      const s = V.passwordStrength(pass.value);
      bar.style.width = (s / 4) * 100 + "%";
      bar.style.background = COLORS[s];
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#rg-name").value, email = $("#rg-email").value;
      const p1 = $("#rg-pass").value, p2 = $("#rg-pass2").value;
      const ok = V.form({
        name: { el: fName, value: name, rules: [V.rules.required, V.rules.min(3)] },
        email: { el: fEmail, value: email, rules: [V.rules.required, V.rules.email] },
        password: { el: fPass, value: p1, rules: [V.rules.required, V.rules.min(6)] },
        confirm: { el: fConf, value: p2, rules: [V.rules.required, V.rules.match(() => p1, "Las contraseñas no coinciden.")] },
      });
      if (!ok) return;

      const btn = $("#regBtn");
      setLoading(btn, true, "Creando");
      try {
        const { token, user } = await App.api.register({ name, email, password: p1 });
        App.store.setSession(token, user);
        App.toast.success("¡Cuenta creada! Bienvenido a Mango.");
        App.router.go("#/dashboard");
      } catch (err) {
        setLoading(btn, false);
        App.toast.error(err.message || "No se pudo crear la cuenta.", "Error");
      }
    });
  };

  /* ---- shared helpers ---- */
  function field(name, label, control) {
    return (
      '<div class="field" data-f="' + name + '">' +
        "<label>" + esc(label) + "</label>" + control +
        '<span class="error-msg">' + icon("alert") + "<span></span></span>" +
      "</div>"
    );
  }
  function bindTheme(container) {
    const b = $("#authTheme", container);
    if (b) b.addEventListener("click", () => { App.store.toggleTheme(); App.router.render(); });
  }
  function setLoading(btn, loading, label) {
    if (loading) { btn.disabled = true; btn.dataset.txt = btn.textContent; btn.innerHTML = '<span class="spinner"></span> ' + (label || "Cargando") + "…"; }
    else { btn.disabled = false; btn.textContent = btn.dataset.txt || btn.textContent; }
  }
  App.ui = App.ui || {};
  App.ui.setLoading = setLoading;
  App.ui.field = field;
})();
