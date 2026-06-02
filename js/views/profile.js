/* =============================================================
   Mango · views/profile.js — Perfil del usuario (#/perfil)
   -------------------------------------------------------------
   Edit personal data (name, phone, city). Email is shown but
   not editable. Persists via PUT /me and updates the session.
   ============================================================= */

window.App = window.App || {};
App.views = App.views || {};

App.views.perfil = async function (container) {
  const { icon, esc, $ } = App.dom;
  const F = App.format;
  const V = App.validate;

  const user = App.store.currentUser();

  // small live stat: number of expenses + total
  let stats = { count: 0, total: 0 };
  try {
    const exp = await App.api.getExpenses();
    stats.count = exp.length;
    stats.total = exp.reduce((a, e) => a + e.amount, 0);
  } catch (e) { /* non-blocking */ }

  container.innerHTML =
    '<div class="page-head"><div>' +
      '<div class="eyebrow">Mi cuenta</div>' +
      "<h1>Perfil</h1>" +
      '<p class="lede">Actualizá tus datos personales.</p>' +
    "</div></div>" +
    '<div class="profile-grid">' +
      '<div class="card profile-aside">' +
        '<div class="big-avatar">' + esc(F.initials(user.name)) + "</div>" +
        "<h3>" + esc(user.name) + "</h3>" +
        '<p class="muted" style="font-size:var(--fs-sm)">' + esc(user.email) + "</p>" +
        '<span class="badge role mt-4">' + (user.role === "advisor" ? "Asesor" : "Usuario") + "</span>" +
        '<div class="mt-6" style="text-align:left">' +
          profStat("Miembro desde", F.monthLong(user.joined)) +
          profStat("Gastos cargados", stats.count) +
          profStat("Total registrado", F.money(stats.total)) +
        "</div>" +
      "</div>" +
      '<div class="card"><div class="card-head"><h3>Datos personales</h3></div>' +
        '<div class="card-body"><form id="profileForm" novalidate>' +
          '<div class="form-grid">' +
            App.ui.field("name", "Nombre completo", '<input class="input" id="pf-name" type="text" value="' + esc(user.name) + '">').replace('class="field"', 'class="field span2"') +
            '<div class="field span2"><label>Email <span class="hint">(no editable)</span></label>' +
              '<input class="input" type="email" value="' + esc(user.email) + '" disabled style="opacity:.7"></div>' +
            '<div class="field"><label>Teléfono</label><input class="input" id="pf-phone" type="tel" placeholder="+54 11 …" value="' + esc(user.phone || "") + '"></div>' +
            '<div class="field"><label>Ciudad</label><input class="input" id="pf-city" type="text" placeholder="Ej. Buenos Aires" value="' + esc(user.city || "") + '"></div>' +
          "</div>" +
          '<div class="row" style="justify-content:flex-end;margin-top:var(--sp-2)">' +
            '<button class="btn btn-primary" type="submit" id="pf-save">' + icon("check") + "Guardar cambios</button>" +
          "</div>" +
        "</form></div></div>" +
    "</div>";

  const form = $("#profileForm", container);
  const fName = form.querySelector('[data-f="name"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#pf-name").value;
    const ok = V.form({ name: { el: fName, value: name, rules: [V.rules.required, V.rules.min(3)] } });
    if (!ok) return;
    const payload = { name, phone: $("#pf-phone").value.trim(), city: $("#pf-city").value.trim() };
    const btn = $("#pf-save");
    App.ui.setLoading(btn, true, "Guardando");
    try {
      const updated = await App.api.updateProfile(payload);
      App.store.patchUser(updated || payload);
      App.ui.setLoading(btn, false);
      App.toast.success("Perfil actualizado.");
      App.router.refreshChrome(); // refresh navbar name/avatar
    } catch (err) {
      App.ui.setLoading(btn, false);
      App.toast.error(err.message || "No se pudo guardar.", "Error");
    }
  });

  function profStat(label, value) {
    return '<div class="profile-stat"><span class="muted">' + esc(label) + '</span><span class="ps-v">' + esc(value) + "</span></div>";
  }
};
