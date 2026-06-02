/* =============================================================
   Mango · views/expenses.js — Listado de gastos (#/gastos)
   -------------------------------------------------------------
   Table with filters (search by merchant, category chips, date
   range), client-side sorting, and edit / delete actions (edit
   opens the reusable form in a modal; delete asks to confirm).
   ============================================================= */

window.App = window.App || {};
App.views = App.views || {};

App.views.gastos = async function (container) {
  const { icon, esc, $, $$ } = App.dom;
  const F = App.format;

  // view state
  let all = [];
  const filters = { q: "", cat: "all", from: "", to: "" };
  let sort = { key: "date", dir: "desc" };

  container.innerHTML =
    '<div class="page-head"><div>' +
      '<div class="eyebrow">Mis movimientos</div>' +
      "<h1>Gastos</h1>" +
    "</div>" +
    '<a class="btn btn-primary" href="#/nuevo">' + icon("plus") + "Cargar gasto</a>" +
    "</div>" +
    '<div class="card"><div class="card-body">' +
      '<div class="toolbar">' +
        '<div class="field search"><label>Buscar comercio</label>' +
          '<div class="input-group" style="position:relative">' +
            '<input class="input" id="fx-q" placeholder="Ej. Coto, Netflix…" style="padding-left:2.4rem">' +
            '<span style="position:absolute;left:.8rem;top:50%;transform:translateY(-50%);color:var(--text-faint)">' + icon("search") + "</span>" +
          "</div></div>" +
        '<div class="field"><label>Desde</label><input class="input" type="date" id="fx-from" max="2026-05-28"></div>' +
        '<div class="field"><label>Hasta</label><input class="input" type="date" id="fx-to" max="2026-05-28"></div>' +
        '<button class="btn btn-soft" id="fx-clear" title="Limpiar filtros">' + icon("x") + "Limpiar</button>" +
      "</div>" +
      '<div class="filter-chips" id="catChips"></div>' +
      '<div class="results-meta" id="resultsMeta"></div>' +
      '<div id="tableHost"></div>' +
    "</div></div>";

  // category chips
  const chipsHost = $("#catChips", container);
  chipsHost.innerHTML =
    chip("all", "Todas") +
    App.mock.categories.map((c) => chip(c.key, c.label, c.key)).join("");
  function chip(key, label, catKey) {
    const sw = catKey ? '<span class="dot" style="background:var(--cat-' + catKey + ')"></span>' : "";
    return '<button class="chip" data-cat="' + key + '">' + sw + esc(label) + "</button>";
  }

  const tableHost = $("#tableHost", container);
  const metaEl = $("#resultsMeta", container);

  // initial load
  tableHost.innerHTML = loaderBlock("Cargando tus gastos…");
  try {
    all = await App.api.getExpenses();
  } catch (err) {
    tableHost.innerHTML = '<div class="empty"><div class="empty-mark">' + icon("alert") + "</div><p>No se pudieron cargar los gastos.</p></div>";
    App.toast.error(err.message || "Error al cargar.", "Error");
    return;
  }
  syncChips();
  renderTable();

  // ---- filtering ----
  function applyFilters() {
    return all.filter((e) => {
      if (filters.cat !== "all" && e.category !== filters.cat) return false;
      if (filters.q && !e.merchant.toLowerCase().includes(filters.q.toLowerCase()) &&
          !(e.description || "").toLowerCase().includes(filters.q.toLowerCase())) return false;
      if (filters.from && e.date < filters.from) return false;
      if (filters.to && e.date > filters.to) return false;
      return true;
    }).sort((a, b) => {
      let r = 0;
      if (sort.key === "date") r = a.date.localeCompare(b.date);
      else if (sort.key === "amount") r = a.amount - b.amount;
      else if (sort.key === "merchant") r = a.merchant.localeCompare(b.merchant);
      else if (sort.key === "category") r = a.category.localeCompare(b.category);
      return sort.dir === "asc" ? r : -r;
    });
  }

  function renderTable() {
    const rows = applyFilters();
    const total = rows.reduce((a, e) => a + e.amount, 0);
    metaEl.innerHTML =
      "<span><strong>" + rows.length + "</strong> de " + all.length + " gasto" + (all.length === 1 ? "" : "s") + "</span>" +
      '<span>Total filtrado: <strong class="mono">' + F.money(total) + "</strong></span>";

    if (!rows.length) {
      tableHost.innerHTML = '<div class="empty"><div class="empty-mark">' + icon("search") + "</div><p>No hay gastos que coincidan con los filtros.</p></div>";
      return;
    }
    tableHost.innerHTML =
      '<div class="table-wrap"><table class="data"><thead><tr>' +
        th("date", "Fecha") + th("merchant", "Comercio") + th("category", "Categoría") +
        "<th>Descripción</th>" + th("amount", "Monto", true) + '<th class="num">Acciones</th>' +
      "</tr></thead><tbody>" +
      rows.map(rowHtml).join("") +
      "</tbody></table></div>";
    bindRows();
    bindSort();
  }

  function th(key, label, num) {
    const aria = sort.key === key ? ' aria-sort="' + (sort.dir === "asc" ? "ascending" : "descending") + '"' : "";
    const ind = sort.key === key ? (sort.dir === "asc" ? "↑" : "↓") : "↕";
    return '<th class="sortable' + (num ? " num" : "") + '" data-sort="' + key + '"' + aria + ">" +
      esc(label) + ' <span class="sort-ind">' + ind + "</span></th>";
  }

  function rowHtml(e) {
    return (
      "<tr data-id=\"" + e.id + "\">" +
        '<td class="nowrap"><span class="mono">' + F.dateShort(e.date) + '</span> <span class="faint" style="font-size:var(--fs-xs)">' + String(F.parse(e.date).getFullYear()).slice(2) + "</span></td>" +
        "<td><strong>" + esc(e.merchant) + "</strong></td>" +
        '<td><span class="badge cat" style="--cat:var(--cat-' + e.category + ')"><span class="dot"></span>' + esc(App.mock.catLabel(e.category)) + "</span></td>" +
        '<td class="muted">' + esc(e.description || "—") + "</td>" +
        '<td class="num">' + F.money(e.amount) + "</td>" +
        '<td><div class="row-actions">' +
          '<button class="edit" data-id="' + e.id + '" title="Editar">' + icon("edit") + "</button>" +
          '<button class="del" data-id="' + e.id + '" title="Eliminar">' + icon("trash") + "</button>" +
        "</div></td>" +
      "</tr>"
    );
  }

  // ---- bindings ----
  function syncChips() {
    $$(".chip", chipsHost).forEach((c) => c.classList.toggle("active", c.dataset.cat === filters.cat));
  }
  App.dom.on(chipsHost, "click", ".chip", (e, el) => { filters.cat = el.dataset.cat; syncChips(); renderTable(); });

  $("#fx-q", container).addEventListener("input", debounce((e) => { filters.q = e.target.value; renderTable(); }, 180));
  $("#fx-from", container).addEventListener("change", (e) => { filters.from = e.target.value; renderTable(); });
  $("#fx-to", container).addEventListener("change", (e) => { filters.to = e.target.value; renderTable(); });
  $("#fx-clear", container).addEventListener("click", () => {
    filters.q = filters.from = filters.to = ""; filters.cat = "all";
    $("#fx-q").value = ""; $("#fx-from").value = ""; $("#fx-to").value = "";
    syncChips(); renderTable();
  });

  function bindSort() {
    $$("th.sortable", tableHost).forEach((th) => th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (sort.key === key) sort.dir = sort.dir === "asc" ? "desc" : "asc";
      else { sort.key = key; sort.dir = key === "merchant" || key === "category" ? "asc" : "desc"; }
      renderTable();
    }));
  }

  function bindRows() {
    $$(".row-actions .edit", tableHost).forEach((b) => b.addEventListener("click", () => openEdit(b.dataset.id)));
    $$(".row-actions .del", tableHost).forEach((b) => b.addEventListener("click", () => removeExpense(b.dataset.id)));
  }

  // ---- edit ----
  function openEdit(id) {
    const exp = all.find((e) => e.id === id);
    if (!exp) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = App.expenseForm.build(exp, { inline: false });
    const m = App.modal.open({ title: "Editar gasto", subtitle: exp.merchant, wide: true, body: wrap,
      footer: '<button class="btn btn-ghost" data-act="cancel">Cancelar</button>' +
              '<button class="btn btn-primary" data-act="save">' + icon("check") + "Guardar cambios</button>" });

    m.footEl.querySelector('[data-act="cancel"]').addEventListener("click", m.close);
    const form = wrap.querySelector("#expForm");
    // route the footer save button through the form's submit/validation
    m.footEl.querySelector('[data-act="save"]').addEventListener("click", () => form.requestSubmit());

    App.expenseForm.bind(wrap, async (data) => {
      const saveBtn = m.footEl.querySelector('[data-act="save"]');
      App.ui.setLoading(saveBtn, true, "Guardando");
      try {
        const updated = await App.api.updateExpense(id, data);
        Object.assign(exp, updated);
        m.close();
        App.toast.success("Gasto actualizado.");
        renderTable();
      } catch (err) {
        App.ui.setLoading(saveBtn, false);
        App.toast.error(err.message || "No se pudo actualizar.", "Error");
      }
    });
  }

  // ---- delete ----
  async function removeExpense(id) {
    const exp = all.find((e) => e.id === id);
    if (!exp) return;
    const ok = await App.modal.confirm({
      title: "Eliminar gasto",
      message: "Vas a eliminar el gasto de " + F.money(exp.amount) + " en " + exp.merchant + ". Esta acción no se puede deshacer.",
      confirmText: "Eliminar", danger: true,
    });
    if (!ok) return;
    try {
      await App.api.deleteExpense(id);
      all = all.filter((e) => e.id !== id);
      App.toast.success("Gasto eliminado.");
      renderTable();
    } catch (err) {
      App.toast.error(err.message || "No se pudo eliminar.", "Error");
    }
  }

  // ---- utils ----
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function loaderBlock(msg) { return '<div class="loader-block"><span class="spinner lg"></span><span>' + esc(msg) + "</span></div>"; }
};
