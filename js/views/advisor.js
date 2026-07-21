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
    '<div id="globalStats" class="mb-6"></div>' +
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
      c._profile = App.analytics.classifyProfile(c._expenses);
    }));
  } catch (err) {
    listEl.innerHTML = '<div class="empty"><p>No se pudieron cargar los clientes.</p></div>';
    App.toast.error(err.message || "Error al cargar clientes.", "Error");
    return;
  }

  clients.sort((a, b) => b._total - a._total);
  $("#clientCount", container).textContent = clients.length;
  renderGlobalStats();
  renderClientList();

  if (!selectedId) renderPlaceholder();
  else selectClient(selectedId);

  function renderGlobalStats() {
    const el = $("#globalStats", container);
    if (!el || !clients.length) return;

    // Combinar todos los gastos de todos los clientes
    const allExpenses = clients.flatMap((c) => c._expenses || []);

    if (!allExpenses.length) {
      el.innerHTML = '';
      return;
    }

    // Calcular estadísticas globales
    const totalGlobal = allExpenses.reduce((s, e) => s + e.amount, 0);
    const avgPerClient = Math.round(totalGlobal / clients.length);
    const clientsWithExpenses = clients.filter((c) => c._total > 0).length;

    // Categoría más gastada globalmente
    const byCat = {};
    allExpenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
    const topCatKey = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a])[0];
    const topCatLabel = topCatKey ? App.mock.catLabel(topCatKey) : '—';

    // Clientes con perfil problemático
    const problematicCount = clients.filter((c) => c._profile && c._profile.problematic).length;

    // Mes con más gasto global
    const byMonth = {};
    allExpenses.forEach((e) => {
      const m = e.date ? e.date.slice(0, 7) : 'unknown';
      byMonth[m] = (byMonth[m] || 0) + e.amount;
    });
    const topMonthKey = Object.keys(byMonth).sort((a, b) => byMonth[b] - byMonth[a])[0];
    const topMonthLabel = topMonthKey ? F.monthLabel(topMonthKey) : '—';

    el.innerHTML =
      '<div class="card"><div class="card-head"><h3>' + icon('users') + 'Estadísticas globales</h3>' +
        '<span class="badge">' + clients.length + ' clientes</span>' +
      '</div><div class="card-body">' +
        '<div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--sp-4)">' +

          // Total facturado
          '<div class="card stat">' +
            '<div class="stat-top"><span class="stat-label">Total facturado</span>' +
              '<span class="stat-ico">' + icon('wallet') + '</span></div>' +
            '<div class="stat-value">' + F.money(totalGlobal) + '</div>' +
            '<div class="stat-sub">Entre todos los clientes</div>' +
          '</div>' +

          // Promedio por cliente
          '<div class="card stat">' +
            '<div class="stat-top"><span class="stat-label">Promedio por cliente</span>' +
              '<span class="stat-ico">' + icon('trend') + '</span></div>' +
            '<div class="stat-value">' + F.money(avgPerClient) + '</div>' +
            '<div class="stat-sub">' + clientsWithExpenses + ' de ' + clients.length + ' con gastos</div>' +
          '</div>' +

          // Categoría más gastada
          '<div class="card stat">' +
            '<div class="stat-top"><span class="stat-label">Categoría top</span>' +
              '<span class="stat-ico accent">' + icon('pie') + '</span></div>' +
            '<div class="stat-value" style="font-size:var(--fs-lg)">' + esc(topCatLabel) + '</div>' +
            '<div class="stat-sub">' + F.money(byCat[topCatKey] || 0) + ' en total</div>' +
          '</div>' +

          // Mes pico
          '<div class="card stat">' +
            '<div class="stat-top"><span class="stat-label">Mes con más gasto</span>' +
              '<span class="stat-ico">' + icon('coins') + '</span></div>' +
            '<div class="stat-value" style="font-size:var(--fs-lg)">' + esc(topMonthLabel) + '</div>' +
            '<div class="stat-sub">' + F.money(byMonth[topMonthKey] || 0) + '</div>' +
          '</div>' +

        '</div>' +

        // Alerta de clientes problemáticos
        (problematicCount > 0
          ? '<div class="anomaly mt-4" style="background:var(--danger-soft)">' +
              '<span class="a-ico" style="color:var(--danger)">' + icon('alert') + '</span>' +
              '<div>' +
                '<strong>' + problematicCount + ' cliente' + (problematicCount === 1 ? '' : 's') + ' con perfil problemático</strong>' +
                '<div style="font-size:var(--fs-xs);color:var(--text-2)">Revisá sus gastos para detectar comportamientos de riesgo.</div>' +
              '</div>' +
            '</div>'
          : '<div style="padding:var(--sp-3);background:var(--primary-soft);border-radius:var(--r-md);margin-top:var(--sp-4);font-size:var(--fs-sm);color:var(--primary-strong)">' +
              icon('check') + ' Ningún cliente presenta comportamiento problemático.' +
            '</div>') +

      '</div></div>';
  }

  function renderClientList() {
    listEl.innerHTML = clients.map((c) =>
      '<button class="client-item' + (c.id === selectedId ? " active" : "") + '" data-id="' + c.id + '">' +
        '<span class="avatar">' + esc(F.initials(c.name)) + "</span>" +
        '<span class="who"><strong>' + esc(c.name) + "</strong><span>" + esc(c.city || c.email) + "</span></span>" +
        '<span class="ci-amount">' + F.money(c._total) + "</span>" +
        (c._profile.problematic ? '<span class="badge" style="background:var(--danger-soft);color:var(--danger)">⚠ Atención</span>' : '') +
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
    const profile = App.analytics.classifyProfile(expenses);

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
          insight('Perfil financiero', profile.label, profile.description) +
        "</div>" +
        (profile.problematic
          ? '<div class="anomaly mt-4" style="background:var(--danger-soft);border:1px solid var(--danger-border);border-radius:var(--radius-sm);padding:var(--sp-3);">' +
              '<span class="a-ico" style="color:var(--danger)">' + icon('alert') + '</span>' +
              '<div><strong>Comportamiento de gasto problemático detectado</strong>' +
              '<div class="faint" style="font-size:var(--fs-xs)">' + esc(profile.description) + '</div></div>' +
            '</div>'
          : '') +

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
            '<div class="row" style="justify-content:flex-end;margin-bottom:var(--sp-3)">' +
              '<button class="btn btn-soft btn-sm" id="aiRecoBtn" type="button">' + icon('sparkle') + 'Generar con IA</button>' +
            '</div>' +
            '<div class="field"><label>Título</label><input class="input" id="reco-title" placeholder="Ej: Reducí gastos en entretenimiento"></div>' +
            '<div class="field"><label>Recomendación</label><textarea class="input" id="reco-text" placeholder="Escribí una sugerencia concreta para este cliente…"></textarea>' +
              '<span class="error-msg">' + icon("alert") + "<span></span></span></div>" +
            '<div class="row" style="justify-content:flex-end"><button class="btn btn-primary" type="submit" id="reco-send">' + icon("sparkle") + "Enviar recomendación</button></div>" +
          "</form>" +
          '<div class="mt-6" id="recoList"></div>' +
        "</div></div>" +

      // consultations
      '<div class="card mt-4"><div class="card-head"><h3>' + icon('sparkle') + 'Consultas del cliente</h3>' +
        '<span class="badge" id="consultBadge">…</span></div>' +
        '<div class="card-body" id="consultPanel">' +
          loaderBlock('Cargando consultas…') +
        '</div></div>';

    renderRecos(recos);
    bindRecoForm(id);
    await loadClientConsultations(id);
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

  function bindRecoForm(id) {
    const aiRecoBtn = $('#aiRecoBtn', detailEl);
    if (aiRecoBtn) {
      aiRecoBtn.addEventListener('click', async () => {
        App.ui.setLoading(aiRecoBtn, true, 'Generando');
        try {
          const result = await App.api.generateAiRecommendation(id);
          const titleInput = $('#reco-title', detailEl);
          const textInput  = $('#reco-text', detailEl);
          if (titleInput) titleInput.value = result.title;
          if (textInput)  textInput.value  = result.text;
          App.toast.success('Recomendación generada. Revisá y guardá.');
        } catch (err) {
          App.toast.error(err.message || 'No se pudo generar la recomendación.', 'Error');
        } finally {
          App.ui.setLoading(aiRecoBtn, false);
        }
      });
    }

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

  async function loadClientConsultations(clientId) {
    const panel = $('#consultPanel', detailEl);
    const badge = $('#consultBadge', detailEl);
    if (!panel) return;
    try {
      // El asesor obtiene TODAS las consultas y filtra por clientId
      const all = await App.api.getAllConsultations();
      const mine = all.filter((c) => c.userId === clientId || (c.user && c.user.id === clientId));
      if (badge) badge.textContent = mine.length;
      if (!mine.length) {
        panel.innerHTML = '<p class="muted center" style="font-size:var(--fs-sm)">Este cliente no tiene consultas aún.</p>';
        return;
      }
      renderConsultations(mine, panel);
    } catch (err) {
      if (panel) panel.innerHTML = '<p class="muted">No se pudieron cargar las consultas.</p>';
    }
  }

  function renderConsultations(list, panel) {
    const pending = list.filter((c) => !c.answer);
    const answered = list.filter((c) => c.answer);

    panel.innerHTML =
      (pending.length ? '<div class="section-title">Pendientes (' + pending.length + ')</div>' : '') +
      pending.map((c) => consultCard(c, true)).join('') +
      (answered.length ? '<div class="section-title mt-4">Respondidas (' + answered.length + ')</div>' : '') +
      answered.map((c) => consultCard(c, false)).join('');

    // Bind submit buttons for pending consultations
    panel.querySelectorAll('.answer-form').forEach((form) => {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const id = form.dataset.id;
        const textarea = form.querySelector('textarea');
        const answer = textarea.value.trim();
        if (!answer || answer.length < 10) {
          App.toast.warning('La respuesta debe tener al menos 10 caracteres.');
          return;
        }
        const btn = form.querySelector('button[type="submit"]');
        App.ui.setLoading(btn, true, 'Respondiendo');
        try {
          await App.api.answerConsultation(id, answer);
          App.toast.success('Respuesta enviada al cliente.');
          await loadClientConsultations(id.split('-')[0]); // reload
          // Reload complete to get fresh data
          const all = await App.api.getAllConsultations();
          const clientId = list[0] && (list[0].userId || (list[0].user && list[0].user.id));
          const fresh = all.filter((c) => c.userId === clientId || (c.user && c.user.id === clientId));
          renderConsultations(fresh, panel);
          const badge = $('#consultBadge', detailEl);
          if (badge) badge.textContent = fresh.length;
        } catch (err) {
          App.toast.error(err.message || 'No se pudo enviar la respuesta.', 'Error');
        } finally {
          App.ui.setLoading(btn, false);
        }
      });
    });
  }

  function consultCard(c, showForm) {
    return '<div class="reco-item">' +
      '<div class="r-top">' + icon(showForm ? 'alert' : 'check') +
        '<strong>' + esc(c.question) + '</strong>' +
        '<span class="r-date">' + F.date(c.createdAt.slice(0, 10)) + '</span>' +
      '</div>' +
      (showForm
        ? '<form class="answer-form mt-2" data-id="' + c.id + '" novalidate>' +
            '<textarea class="input" rows="3" placeholder="Escribí tu respuesta…" style="margin-bottom:var(--sp-2)"></textarea>' +
            '<div class="row" style="justify-content:flex-end">' +
              '<button class="btn btn-primary btn-sm" type="submit">' + icon('sparkle') + 'Responder</button>' +
            '</div>' +
          '</form>'
        : '<div class="mt-2" style="padding:var(--sp-3);background:var(--surface-2);border-radius:var(--radius-sm)">' +
            '<div class="eyebrow mb-1">Tu respuesta · ' + F.date(c.answeredAt.slice(0, 10)) + '</div>' +
            '<p>' + esc(c.answer) + '</p>' +
          '</div>') +
    '</div>';
  }

  function insight(label, value, note) {
    return '<div class="insight"><div class="i-label">' + esc(label) + '</div><div class="i-value">' + esc(value) + "</div>" +
      (note ? '<div class="i-note">' + esc(note) + "</div>" : "") + "</div>";
  }
  function loaderBlock(msg) { return '<div class="loader-block"><span class="spinner lg"></span><span>' + esc(msg) + "</span></div>"; }
};
