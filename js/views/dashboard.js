/* =============================================================
   Mango · views/dashboard.js — Resumen del usuario (#/dashboard)
   -------------------------------------------------------------
   Summary cards + category doughnut + monthly bars + merchant
   ranking. All figures come from App.analytics over the user's
   own expenses.
   ============================================================= */

window.App = window.App || {};
App.views = App.views || {};

App.views.dashboard = async function (container) {
  const { icon, esc, $ } = App.dom;
  const F = App.format;

  // tear down any charts from a previous visit
  App.scratch = App.scratch || {};
  (App.scratch.charts || []).forEach((c) => { try { c.destroy(); } catch (e) {} });
  App.scratch.charts = [];

  const user = App.store.currentUser();

  // loading skeleton
  container.innerHTML =
    headHtml(user) +
    '<div class="stat-grid">' + skelStat() + skelStat() + skelStat() + skelStat() + skelStat() + "</div>" +
    '<div class="dash-grid"><div class="card" style="height:420px"></div><div class="card" style="height:420px"></div></div>';

  let expenses;
  try { expenses = await App.api.getExpenses(); }
  catch (err) { App.toast.error(err.message || "Error al cargar.", "Error"); return; }

  if (!expenses.length) {
    container.innerHTML = headHtml(user) +
      '<div class="card"><div class="empty"><div class="empty-mark">' + icon("wallet") + "</div>" +
      "<h3>Todavía no cargaste gastos</h3><p>Empezá cargando tu primer gasto para ver tus estadísticas.</p>" +
      '<a class="btn btn-primary mt-4" href="#/nuevo">' + icon("plus") + "Cargar mi primer gasto</a></div></div>";
    return;
  }

  const a = App.analytics.compute(expenses);
  showAutoNotifications(a);

  const deltaCls = a.deltaPct > 0 ? "up" : "down";
  const deltaIco = a.deltaPct > 0 ? "arrowUp" : "arrowDown";
  const deltaTxt = a.totalPrevMonth
    ? '<span class="delta ' + deltaCls + '">' + icon(deltaIco) + Math.abs(a.deltaPct) + "%</span> vs. mes anterior"
    : "Primer mes con datos";

  container.innerHTML =
    headHtml(user) +
    '<div class="stat-grid">' +
      stat("Gasto del mes", F.money(a.totalThisMonth), F.MONTHS[new Date(2026,4,28).getMonth()] + " 2026", "coins", "", deltaTxt) +
      stat("Promedio mensual", F.money(a.avgMonthly), "Últimos 6 meses", "trend", "") +
      stat("Promedio semanal", F.money(a.avgWeekly), "Últimos 6 meses", "calendar", "") +
      stat("Total registrado", F.money(a.totalAll), a.count + " gastos en 6 meses", "wallet", "") +
      stat("Categoría top", a.dominant ? a.dominant.label : "—", a.dominant ? F.money(a.dominant.total) + " · " + a.dominant.pct + "%" : "", "pie", "accent") +
    "</div>" +
    alertsHtml(a) +
    '<div class="dash-grid">' +
      // left: monthly bars
      '<div class="card"><div class="card-head"><h3>Gasto por mes</h3>' +
        '<span class="badge">' + icon("calendar") + "6 meses</span></div>" +
        '<div class="card-body"><div class="chart-box tall"><canvas id="barChart"></canvas></div></div></div>' +
      // right: category pie + legend
      '<div class="card"><div class="card-head"><h3>Por categoría</h3>' +
        '<span class="badge">' + icon("pie") + a.catList.filter((c)=>c.total>0).length + " categorías</span></div>" +
        '<div class="card-body"><div class="chart-box"><canvas id="pieChart"></canvas></div>' +
        '<div class="legend" id="pieLegend"></div></div></div>' +
    "</div>" +
    // merchant ranking
    '<div class="card mt-6"><div class="card-head"><h3>Comercios más frecuentes</h3>' +
      '<span class="badge">' + icon("receipt") + "Top " + a.merchantRanking.length + "</span></div>" +
      '<div class="card-body"><div class="rank-list" id="rankList"></div></div></div>' +

    // Comparación entre meses
    '<div class="card mt-6"><div class="card-head"><h3>' + icon("trend") + 'Comparación mensual</h3>' +
      '<span class="badge">' + F.monthLabel(a.prevKey) + ' vs ' + F.monthLabel(a.curKey) + '</span>' +
    '</div><div class="card-body"><div id="monthCompare"></div></div></div>';

  // charts
  App.scratch.charts.push(App.charts.monthlyBars($("#barChart"), a.months, a.monthValues));
  App.scratch.charts.push(App.charts.categoryPie($("#pieChart"), a.catList));

  // pie legend
  $("#pieLegend").innerHTML = a.catList.filter((c) => c.total > 0).map((c) =>
    '<div class="legend-item">' +
      '<span class="sw" style="background:var(--cat-' + c.key + ')"></span>' +
      "<span>" + esc(c.label) + "</span>" +
      '<span class="lv">' + F.money(c.total) + "</span>" +
      '<span class="lp">' + c.pct + "%</span>" +
    "</div>").join("");

  // merchant ranking
  $("#rankList").innerHTML = a.merchantRanking.map((m, i) =>
    '<div class="rank-item">' +
      '<span class="rank-pos">' + (i + 1) + "</span>" +
      "<div><div class=\"rank-name\">" + esc(m.merchant) + "</div>" +
        '<div class="rank-meta">' + m.count + " compra" + (m.count === 1 ? "" : "s") + "</div>" +
        '<div class="rank-bar" style="width:' + Math.max(12, (m.count / a.maxMerchantCount) * 100) + "%\"></div></div>" +
      '<span class="rank-amount">' + F.money(m.total) + "</span>" +
    "</div>").join("");

  // ── Comparación mensual ─────────────────────────────────────
  (function () {
    const el = $("#monthCompare", container);
    if (!el) return;

    if (!a.totalPrevMonth && !a.totalThisMonth) {
      el.innerHTML = '<p class="muted" style="font-size:var(--fs-sm)">Necesitás gastos en al menos dos meses para ver la comparación.</p>';
      return;
    }

    // Calcular porcentajes para las barras (relativo al mayor)
    const maxVal = Math.max(a.totalPrevMonth, a.totalThisMonth) || 1;
    const prevPct = Math.round((a.totalPrevMonth / maxVal) * 100);
    const curPct  = Math.round((a.totalThisMonth  / maxVal) * 100);

    // Mensaje interpretativo
    let msg = "";
    if (!a.totalPrevMonth) {
      msg = "Es tu primer mes con datos registrados.";
    } else if (a.deltaPct === 0) {
      msg = "Gastaste exactamente lo mismo que el mes anterior.";
    } else if (a.deltaPct > 0) {
      msg = "Gastaste un <strong>" + a.deltaPct + "% más</strong> que el mes pasado. Revisá en qué categorías aumentó.";
    } else {
      msg = "¡Gastaste un <strong>" + Math.abs(a.deltaPct) + "% menos</strong> que el mes pasado! Vas bien.";
    }

    const deltaClass = a.deltaPct > 0 ? "danger" : a.deltaPct < 0 ? "success" : "neutral";
    const deltaIco   = a.deltaPct > 0 ? icon("arrowUp") : a.deltaPct < 0 ? icon("arrowDown") : "";

    el.innerHTML =
      // Barras comparativas
      '<div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-bottom:var(--sp-4)">' +

        // Mes anterior
        '<div>' +
          '<div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);margin-bottom:var(--sp-1)">' +
            '<span style="color:var(--text-2)">' + F.monthLabel(a.prevKey) + '</span>' +
            '<span class="mono">' + F.money(a.totalPrevMonth) + '</span>' +
          '</div>' +
          '<div style="background:var(--surface-3);border-radius:var(--r-full);height:10px;overflow:hidden">' +
            '<div style="height:100%;width:' + prevPct + '%;background:var(--surface-inverse);border-radius:var(--r-full);transition:width .5s ease"></div>' +
          '</div>' +
        '</div>' +

        // Mes actual
        '<div>' +
          '<div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);margin-bottom:var(--sp-1)">' +
            '<span style="font-weight:600">' + F.monthLabel(a.curKey) + ' (actual)</span>' +
            '<span class="mono" style="font-weight:600">' + F.money(a.totalThisMonth) + '</span>' +
          '</div>' +
          '<div style="background:var(--surface-3);border-radius:var(--r-full);height:10px;overflow:hidden">' +
            '<div style="height:100%;width:' + curPct + '%;background:var(--primary);border-radius:var(--r-full);transition:width .5s ease"></div>' +
          '</div>' +
        '</div>' +

      '</div>' +

      // Diferencia + mensaje
      '<div style="display:flex;align-items:center;gap:var(--sp-2);padding:var(--sp-3);background:var(--surface-2);border-radius:var(--r-md)">' +
        (a.totalPrevMonth ? '<span style="font-size:1.1rem;color:var(--' + deltaClass + ')">' + deltaIco + '</span>' : '') +
        '<p style="font-size:var(--fs-sm);margin:0">' + msg + '</p>' +
      '</div>';
  })();

  // ---- helpers ----
  function headHtml(u) {
    return '<div class="page-head"><div>' +
      '<div class="eyebrow">Hola, ' + esc(u.name.split(" ")[0]) + "</div>" +
      "<h1>Tu resumen</h1>" +
      '<p class="lede">Así viene tu mes. Revisá en qué estás gastando más y ajustá a tiempo.</p>' +
    "</div>" +
    '<a class="btn btn-primary" href="#/nuevo">' + icon("plus") + "Cargar gasto</a></div>";
  }
  function stat(label, value, sub, ico, kind, deltaHtml) {
    return '<div class="card stat">' +
      '<div class="stat-top"><span class="stat-label">' + esc(label) + "</span>" +
        '<span class="stat-ico ' + (kind || "") + '">' + icon(ico) + "</span></div>" +
      '<div class="stat-value">' + esc(value) + "</div>" +
      '<div class="stat-sub">' + (deltaHtml || esc(sub)) + "</div>" +
    "</div>";
  }
  function skelStat() { return '<div class="card stat"><div class="skel" style="height:14px;width:60%"></div><div class="skel" style="height:34px;width:80%;margin:12px 0 8px"></div><div class="skel" style="height:12px;width:50%"></div></div>'; }

  function alertsHtml(a) {
    const items = [];

    // 1. Gasto mensual muy por encima del promedio
    if (a.avgMonthly > 0 && a.totalThisMonth > a.avgMonthly * 1.2) {
      const overpct = Math.round(((a.totalThisMonth - a.avgMonthly) / a.avgMonthly) * 100);
      items.push(
        '<div class="anomaly">' +
          '<span class="a-ico">' + icon("alert") + "</span>" +
          '<div>' +
            '<div style="font-size:var(--fs-sm);font-weight:600">Gasto mensual elevado</div>' +
            '<div style="font-size:var(--fs-xs);color:var(--text-2)">Este mes gastaste un ' + overpct + '% más que tu promedio habitual.</div>' +
          "</div>" +
          '<span class="a-amount">' + F.money(a.totalThisMonth) + "</span>" +
        "</div>"
      );
    }

    // 2. Crecimiento acelerado vs mes anterior
    if (a.totalPrevMonth > 0 && a.deltaPct > 30) {
      items.push(
        '<div class="anomaly">' +
          '<span class="a-ico">' + icon("arrowUp") + "</span>" +
          '<div>' +
            '<div style="font-size:var(--fs-sm);font-weight:600">Crecimiento acelerado</div>' +
            '<div style="font-size:var(--fs-xs);color:var(--text-2)">Tu gasto subió un ' + a.deltaPct + '% respecto al mes anterior.</div>' +
          "</div>" +
          '<span class="a-amount">+' + a.deltaPct + "%</span>" +
        "</div>"
      );
    }

    // 3. Gastos individuales inusuales (ya calculados por analytics)
    a.anomalies.forEach((e) => {
      items.push(
        '<div class="anomaly">' +
          '<span class="a-ico">' + icon("alert") + "</span>" +
          '<div>' +
            '<div style="font-size:var(--fs-sm);font-weight:600">Gasto inusual detectado</div>' +
            '<div style="font-size:var(--fs-xs);color:var(--text-2)">' +
              esc(e.merchant) + " · " + esc(App.mock.catLabel(e.category)) + " · " + F.date(e.date) +
            "</div>" +
          "</div>" +
          '<span class="a-amount">' + F.money(e.amount) + "</span>" +
        "</div>"
      );
    });

    if (!items.length) return "";

    return (
      '<div class="card mt-6" style="border-color:var(--warning)">' +
        '<div class="card-head">' +
          '<h3 style="color:var(--warning)">' + icon("alert") + "Alertas</h3>" +
          '<span class="badge">' + items.length + " alerta" + (items.length === 1 ? "" : "s") + "</span>" +
        "</div>" +
        '<div class="card-head" style="border-top:none;padding-top:0;margin-top:calc(var(--sp-2) * -1)"><p style="font-size:var(--fs-sm);margin:0;color:var(--text-2)">Se detectaron patrones de consumo atípicos o aumentos significativos este mes.</p></div>' +
        '<div class="card-body">' + items.join("") + "</div>" +
      "</div>"
    );
  }

  function showAutoNotifications(a) {
    // Solo mostrar una vez por sesión para no molestar al usuario
    const sessionKey = 'mango_notif_shown_' + (App.store.currentUser()?.id || 'u');
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');

    // Pequeño delay para que los toasts aparezcan después de que carga la UI
    setTimeout(() => {

      // 1. Gasto mensual muy elevado (>20% sobre el promedio)
      if (a.avgMonthly > 0 && a.totalThisMonth > a.avgMonthly * 1.2) {
        const overpct = Math.round(((a.totalThisMonth - a.avgMonthly) / a.avgMonthly) * 100);
        App.toast.warning(
          'Gastaste un ' + overpct + '% más que tu promedio este mes.',
          'Gasto elevado'
        );
      }

      // 2. Crecimiento acelerado vs mes anterior (>30%)
      if (a.totalPrevMonth > 0 && a.deltaPct > 30) {
        App.toast.warning(
          'Tu gasto subió un ' + a.deltaPct + '% respecto al mes pasado.',
          'Tendencia al alza'
        );
      }

      // 3. Gastos inusuales detectados
      if (a.anomalies && a.anomalies.length > 0) {
        const label = a.anomalies.length === 1
          ? 'Hay 1 gasto inusual en tu historial.'
          : 'Hay ' + a.anomalies.length + ' gastos inusuales en tu historial.';
        App.toast.warning(label, 'Gastos anómalos');
      }

      // 4. Mensaje positivo si todo está bien
      if (
        a.totalThisMonth <= (a.avgMonthly * 1.2 || Infinity) &&
        (!a.anomalies || a.anomalies.length === 0) &&
        a.deltaPct <= 30
      ) {
        App.toast.success('Tus gastos están bajo control este mes.', '¡Todo bien!');
      }

    }, 800);
  }
};
