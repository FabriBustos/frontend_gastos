/* =============================================================
   Mango · views/advisor.js — Panel del asesor (#/asesor)
   -------------------------------------------------------------
   List of registered users; selecting one loads their expenses
   and shows consumption patterns (average spend, dominant
   category, unusual expenses) plus a form to leave financial
   recommendations.
   ============================================================= */

window.App = window.App || {};
App.views = App.views || {};

App.views.asesor = async function (container, params) {
  const { icon, esc, $, $$ } = App.dom;
  const F = App.format;

  let clients = [];
  let selectedId = (params && params.id) || null;

  container.innerHTML =
    '<div class="page-head"><div>' +
      '<div class="eyebrow">Asesoría financiera</div>' +
      "<h1>Panel de clientes</h1>" +
      '<p class="lede">Seleccioná un cliente para analizar sus patrones de consumo y dejarle recomendaciones.</p>' +
    "</div></div>" +
    '<div class="advisor-grid">' +
      '<div class="card"><div class="card-head"><h3>Clientes</h3><span class="badge" id="clientCount">…</span></div>' +
        '<div class="client-list" id="clientList">' + loaderBlock("Cargando…") + "</div></div>" +
      '<div id="detail"></div>' +
    "</div>";

  const listEl = $("#clientList", container);
  const detailEl = $("#detail", container);

  // load clients + their totals (so we can show a spend figure in the list)
  try {
    clients = await App.api.listUsers();
    // fetch each client's expenses once to compute their list total
    await Promise.all(clients.map(async (c) => {
      c._expenses = await App.api.getExpenses(c.id);
      c._total = c._expenses.reduce((a, e) => a + e.amount, 0);
    }));
  } catch (err) {
    listEl.innerHTML = '<div class="empty"><p>No se pudieron cargar los clientes.</p></div>';
    App.toast.error(err.message || "Error al cargar clientes.", "Error");
    return;
  }

  clients.sort((a, b) => b._total - a._total);
  $("#clientCount", container).textContent = clients.length;
  renderClientList();

  if (!selectedId) renderPlaceholder();
  else selectClient(selectedId);

  function renderClientList() {
    listEl.innerHTML = clients.map((c) =>
      '<button class="client-item' + (c.id === selectedId ? " active" : "") + '" data-id="' + c.id + '">' +
        '<span class="avatar">' + esc(F.initials(c.name)) + "</span>" +
        '<span class="who"><strong>' + esc(c.name) + "</strong><span>" + esc(c.city || c.email) + "</span></span>" +
        '<span class="ci-amount">' + F.money(c._total) + "</span>" +
      "</button>").join("");
    $$(".client-item", listEl).forEach((b) => b.addEventListener("click", () => {
      selectedId = b.dataset.id;
      App.router.replaceHash("#/asesor/" + selectedId); // update hash, keep state
      renderClientList();
      selectClient(selectedId);
    }));
  }

  function renderPlaceholder() {
    detailEl.innerHTML =
      '<div class="card"><div class="placeholder-pick"><div>' +
        '<div class="pp-ico">' + icon("users") + "</div>" +
        "<h3>Elegí un cliente</h3>" +
        '<p class="muted">Seleccioná a alguien de la lista para ver su análisis de gastos.</p>' +
      "</div></div></div>";
  }

  async function selectClient(id) {
    const client = clients.find((c) => c.id === id);
    if (!client) { renderPlaceholder(); return; }

    detailEl.innerHTML = '<div class="card" style="min-height:360px">' + loaderBlock("Analizando gastos…") + "</div>";

    const expenses = client._expenses || [];
    const recos = await App.api.getRecommendations(id).catch(() => []);
    const a = App.analytics.compute(expenses);

    detailEl.innerHTML =
      // client header
      '<div class="card"><div class="card-body row-between" style="flex-wrap:wrap;gap:var(--sp-4)">' +
        '<div class="row" style="gap:var(--sp-3)"><span class="avatar" style="width:48px;height:48px;font-size:1.1rem">' + esc(F.initials(client.name)) + "</span>" +
          "<div><h3>" + esc(client.name) + "</h3><p class=\"muted\" style=\"font-size:var(--fs-sm)\">" + esc(client.email) + " · Cliente desde " + F.monthLong(client.joined) + "</p></div></div>" +
        '<a class="btn btn-ghost btn-sm" href="#/asesor">' + icon("arrowDown") + "Cambiar cliente</a>" +
      "</div></div>" +

      // patterns
      '<div class="card mt-4"><div class="card-head"><h3>Patrones de consumo</h3>' +
        '<span class="badge">' + a.count + " gastos · 6 meses</span></div>" +
        '<div class="card-body"><div class="insight-grid">' +
          insight("Gasto promedio mensual", F.money(a.avgMonthly), "Sobre los últimos 6 meses") +
          insight("Gasto de " + F.MONTHS[4] + ".", F.money(a.totalThisMonth),
            (a.totalPrevMonth ? (a.deltaPct >= 0 ? "▲ " : "▼ ") + Math.abs(a.deltaPct) + "% vs. mes anterior" : "—")) +
          insight("Categoría dominante", a.dominant ? a.dominant.label : "—",
            a.dominant ? a.dominant.pct + "% del total · " + F.money(a.dominant.total) : "") +
        "</div>" +

        // anomalies
        '<div class="mt-6"><div class="section-title">Gastos inusuales detectados</div>' +
          (a.anomalies.length
            ? a.anomalies.map((e) =>
                '<div class="anomaly"><span class="a-ico">' + icon("alert") + "</span>" +
                  "<div><strong>" + esc(e.merchant) + '</strong> <span class="badge cat" style="--cat:var(--cat-' + e.category + ');margin-left:6px"><span class="dot"></span>' + esc(App.mock.catLabel(e.category)) + "</span>" +
                  '<div class="faint" style="font-size:var(--fs-xs)">' + F.date(e.date) + " · " + esc(e.description || "") + "</div></div>" +
                  '<span class="a-amount">' + F.money(e.amount) + "</span></div>")
              .join("")
            : '<p class="muted" style="font-size:var(--fs-sm)">No se detectaron gastos fuera de lo habitual este mes.</p>') +
        "</div></div></div>" +

      // recommendations
      '<div class="card mt-4"><div class="card-head"><h3>Recomendaciones</h3>' +
        '<span class="badge">' + recos.length + "</span></div>" +
        '<div class="card-body">' +
          '<form id="recoForm" novalidate>' +
            '<div class="field"><label>Título</label><input class="input" id="reco-title" placeholder="Ej. Reducir gastos en delivery"></div>' +
            '<div class="field"><label>Recomendación</label><textarea class="input" id="reco-text" placeholder="Escribí una sugerencia concreta para este cliente…"></textarea>' +
              '<span class="error-msg">' + icon("alert") + "<span></span></span></div>" +
            '<div class="row" style="justify-content:flex-end"><button class="btn btn-primary" type="submit" id="reco-send">' + icon("sparkle") + "Enviar recomendación</button></div>" +
          "</form>" +
          '<div class="mt-6" id="recoList"></div>' +
        "</div></div>";

    renderRecos(recos);
    bindRecoForm(id);
  }

  function renderRecos(recos) {
    const host = $("#recoList", detailEl);
    if (!host) return;
    if (!recos.length) { host.innerHTML = '<p class="muted center" style="font-size:var(--fs-sm)">Todavía no le dejaste recomendaciones a este cliente.</p>'; return; }
    host.innerHTML = '<div class="section-title">Historial</div>' + recos.map((r) =>
      '<div class="reco-item"><div class="r-top">' + icon("target") +
        "<strong>" + esc(r.title) + '</strong><span class="r-date">' + F.date(r.createdAt.slice(0, 10)) + "</span></div>" +
        "<p>" + esc(r.text) + "</p></div>").join("");
  }

  function bindRecoForm(clientId) {
    const form = $("#recoForm", detailEl);
    const fText = form.querySelector('[data-f]') || form.querySelector(".field:nth-child(2)");
    const textField = $("#reco-text", form).closest(".field");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = $("#reco-title", form).value.trim() || "Recomendación";
      const text = $("#reco-text", form).value.trim();
      const ok = App.validate.form({ text: { el: textField, value: text, rules: [App.validate.rules.required, App.validate.rules.min(10)] } });
      if (!ok) return;
      const btn = $("#reco-send", form);
      App.ui.setLoading(btn, true, "Enviando");
      try {
        await App.api.addRecommendation({ userId: clientId, title, text });
        const recos = await App.api.getRecommendations(clientId);
        App.ui.setLoading(btn, false);
        $("#reco-title", form).value = ""; $("#reco-text", form).value = "";
        App.toast.success("Recomendación enviada al cliente.");
        renderRecos(recos);
        // bump the counter badge
        const badge = detailEl.querySelectorAll(".card-head .badge");
        if (badge.length) badge[badge.length - 1].textContent = recos.length;
      } catch (err) {
        App.ui.setLoading(btn, false);
        App.toast.error(err.message || "No se pudo enviar.", "Error");
      }
    });
  }

  function insight(label, value, note) {
    return '<div class="insight"><div class="i-label">' + esc(label) + '</div><div class="i-value">' + esc(value) + "</div>" +
      (note ? '<div class="i-note">' + esc(note) + "</div>" : "") + "</div>";
  }
  function loaderBlock(msg) { return '<div class="loader-block"><span class="spinner lg"></span><span>' + esc(msg) + "</span></div>"; }
};
