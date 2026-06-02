/* =============================================================
   Mango · views/expenseForm.js
   -------------------------------------------------------------
   Reusable expense <form>: used both by the standalone "Cargar
   gasto" page (#/nuevo) and inside the edit modal on the list.
   build(values) returns the form HTML; bind(form, onValid)
   wires validation and calls onValid(data) on a clean submit.
   ============================================================= */

window.App = window.App || {};
App.views = App.views || {};

App.expenseForm = (function () {
  const { icon, esc } = App.dom;
  const V = App.validate;

  function categoryOptions(selected) {
    return App.mock.categories.map((c) =>
      '<option value="' + c.key + '"' + (c.key === selected ? " selected" : "") + ">" + esc(c.label) + "</option>"
    ).join("");
  }

  /* values: { merchant, amount, category, date, description } */
  function build(values, opts) {
    values = values || {};
    opts = opts || {};
    const submitLabel = opts.submitLabel || "Guardar gasto";
    return (
      '<form id="expForm" novalidate>' +
        '<div class="form-grid">' +
          fieldWrap("merchant", "Comercio", "span2",
            '<input class="input" type="text" id="ef-merchant" placeholder="Ej. Coto, YPF, Netflix…" value="' + esc(values.merchant || "") + '">') +
          fieldWrap("amount", "Monto",  "",
            '<div class="input-group"><span class="prefix">$</span>' +
            '<input class="input has-prefix" type="number" inputmode="numeric" min="0" step="1" id="ef-amount" placeholder="0" value="' + esc(values.amount || "") + '"></div>') +
          fieldWrap("date", "Fecha", "",
            '<input class="input" type="date" id="ef-date" max="2026-05-28" value="' + esc(values.date || "") + '">') +
          fieldWrap("category", "Categoría", "span2",
            '<select class="select" id="ef-category"><option value="" disabled' + (values.category ? "" : " selected") + ">Elegí una categoría</option>" +
            categoryOptions(values.category) + "</select>") +
          fieldWrap("description", "Descripción", "span2",
            '<textarea class="input" id="ef-desc" placeholder="Nota opcional (ej. compra semanal)">' + esc(values.description || "") + "</textarea>", true) +
        "</div>" +
        (opts.inline === false ? "" :
          '<div class="row" style="justify-content:flex-end;gap:var(--sp-3);margin-top:var(--sp-2)">' +
            (opts.cancelHref ? '<a class="btn btn-ghost" href="' + opts.cancelHref + '">Cancelar</a>' : "") +
            '<button class="btn btn-primary" type="submit" id="ef-submit">' + icon("check") + esc(submitLabel) + "</button>" +
          "</div>") +
      "</form>"
    );
  }

  function fieldWrap(name, label, span, control, optional) {
    return (
      '<div class="field ' + (span || "") + '" data-f="' + name + '">' +
        "<label>" + esc(label) + (optional ? ' <span class="hint">(opcional)</span>' : "") + "</label>" +
        control +
        '<span class="error-msg">' + icon("alert") + "<span></span></span>" +
      "</div>"
    );
  }

  /* Wire validation. onValid receives the sanitized payload. */
  function bind(root, onValid) {
    const form = root.querySelector("#expForm");
    const get = (id) => form.querySelector("#" + id);
    const fields = {
      merchant: form.querySelector('[data-f="merchant"]'),
      amount: form.querySelector('[data-f="amount"]'),
      date: form.querySelector('[data-f="date"]'),
      category: form.querySelector('[data-f="category"]'),
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = {
        merchant: get("ef-merchant").value,
        amount: get("ef-amount").value,
        date: get("ef-date").value,
        category: get("ef-category").value,
        description: get("ef-desc").value,
      };
      const ok = V.form({
        merchant: { el: fields.merchant, value: data.merchant, rules: [V.rules.required, V.rules.min(2)] },
        amount: { el: fields.amount, value: data.amount, rules: [V.rules.required, V.rules.money] },
        date: { el: fields.date, value: data.date, rules: [V.rules.required, V.rules.date, V.rules.notFuture] },
        category: { el: fields.category, value: data.category, rules: [V.rules.required] },
      });
      if (!ok) return;
      onValid(data, form);
    });
    return form;
  }

  return { build, bind };
})();

/* ---------------- Standalone "Cargar gasto" page (#/nuevo) ---------------- */
App.views.nuevo = async function (container, params) {
  const { icon } = App.dom;
  const prefill = App.scratch && App.scratch.ticketPrefill ? App.scratch.ticketPrefill : {};
  if (App.scratch) App.scratch.ticketPrefill = null; // consume once

  const fromTicket = !!prefill.merchant;
  container.innerHTML =
    '<div class="page-head"><div>' +
      '<div class="eyebrow">Nuevo gasto</div>' +
      "<h1>Cargar un gasto</h1>" +
      '<p class="lede">Completá los datos del gasto. Los campos marcados son obligatorios.</p>' +
    "</div></div>" +
    (fromTicket ? '<div class="card" style="margin-bottom:var(--sp-4);border-color:color-mix(in srgb,var(--primary) 40%,transparent)">' +
      '<div class="card-pad row" style="gap:var(--sp-3)"><span class="extracted-tag">' + icon("sparkle") + "Pre-cargado desde un ticket</span>" +
      '<span class="muted" style="font-size:var(--fs-sm)">Revisá los datos detectados antes de guardar.</span></div></div>' : "") +
    '<div class="card" style="max-width:640px"><div class="card-body">' +
      App.expenseForm.build(prefill, { submitLabel: "Guardar gasto", cancelHref: "#/gastos" }) +
    "</div></div>";

  App.expenseForm.bind(container, async (data, form) => {
    const btn = form.querySelector("#ef-submit");
    App.ui.setLoading(btn, true, "Guardando");
    try {
      await App.api.createExpense(data);
      App.toast.success("Gasto de " + App.format.money(data.amount) + " en " + data.merchant + " guardado.", "Listo");
      App.router.go("#/gastos");
    } catch (err) {
      App.ui.setLoading(btn, false);
      App.toast.error(err.message || "No se pudo guardar.", "Error");
    }
  });
};
