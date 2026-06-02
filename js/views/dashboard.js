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
    '<div class="stat-grid">' + skelStat() + skelStat() + skelStat() + skelStat() + "</div>" +
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
      stat("Total registrado", F.money(a.totalAll), a.count + " gastos en 6 meses", "wallet", "") +
      stat("Categoría top", a.dominant ? a.dominant.label : "—", a.dominant ? F.money(a.dominant.total) + " · " + a.dominant.pct + "%" : "", "pie", "accent") +
    "</div>" +
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
      '<div class="card-body"><div class="rank-list" id="rankList"></div></div></div>';

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
};
