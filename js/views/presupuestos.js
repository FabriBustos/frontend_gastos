/* =============================================================
   Mango · views/presupuestos.js — Presupuestos (#/presupuestos)
   -------------------------------------------------------------
   El usuario define límites de gasto por categoría para el mes
   actual. El sistema muestra el progreso (gastado vs límite).
   ============================================================= */

window.App = window.App || {};
App.views = App.views || {};

App.views.presupuestos = async function (container) {
  const { icon, esc, $ } = App.dom;
  const F = App.format;

  // Mes actual en formato YYYY-MM
  const now = new Date();
  const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const monthLabel = F.MONTHS[now.getMonth()] + ' ' + now.getFullYear();

  const CATEGORIES = [
    { key: 'COMIDA',          label: 'Comida' },
    { key: 'TRANSPORTE',      label: 'Transporte' },
    { key: 'SALUD',           label: 'Salud' },
    { key: 'ENTRETENIMIENTO', label: 'Entretenimiento' },
    { key: 'SERVICIOS',       label: 'Servicios' },
    { key: 'COMPRAS',         label: 'Compras' },
    { key: 'EDUCACION',       label: 'Educación' },
    { key: 'OTROS',           label: 'Otros' },
  ];

  container.innerHTML =
    '<div class="page-head"><div>' +
      '<div class="eyebrow">Finanzas</div>' +
      '<h1>Presupuestos</h1>' +
      '<p class="lede">Establecé un límite de gasto por categoría para <strong>' + monthLabel + '</strong> y seguí tu progreso.</p>' +
    '</div></div>' +
    '<div id="budgetContent"><div class="loader-block"><span class="spinner lg"></span><span>Cargando…</span></div></div>';

  const contentEl = $('#budgetContent', container);

  async function load() {
    try {
      const [budgets, expenses] = await Promise.all([
        App.api.getBudgets(currentMonth),
        App.api.getExpenses(),
      ]);

      // Calcular gasto del mes actual por categoría
      const spentByCat = {};
      expenses
        .filter((e) => e.date && e.date.slice(0, 7) === currentMonth)
        .forEach((e) => {
          const cat = (e.category || '').toUpperCase();
          spentByCat[cat] = (spentByCat[cat] || 0) + e.amount;
        });

      render(budgets, spentByCat);
    } catch (err) {
      contentEl.innerHTML = '<p class="muted">No se pudieron cargar los presupuestos.</p>';
      App.toast.error(err.message || 'Error al cargar.', 'Error');
    }
  }

  function render(budgets, spentByCat) {
    const budgetByCat = {};
    budgets.forEach((b) => { budgetByCat[b.category] = b; });

    contentEl.innerHTML =
      '<div class="card"><div class="card-head"><h3>' + icon('wallet') + 'Mis presupuestos · ' + monthLabel + '</h3>' +
        '<span class="badge">' + budgets.length + ' definidos</span>' +
      '</div><div class="card-body">' +
        CATEGORIES.map((cat) => {
          const budget = budgetByCat[cat.key];
          const spent  = spentByCat[cat.key] || 0;
          const limit  = budget ? budget.amount : 0;
          const pct    = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
          const over   = limit > 0 && spent > limit;
          const barColor = over ? 'var(--danger)' : pct >= 80 ? 'var(--warning)' : 'var(--primary)';

          return '<div class="reco-item" id="cat-' + cat.key + '">' +
            '<div class="r-top">' +
              '<strong>' + esc(cat.label) + '</strong>' +
              (budget
                ? '<span class="badge" style="color:var(--danger);cursor:pointer" data-del="' + budget.id + '">✕ Quitar</span>'
                : '') +
              '<span class="r-date">' + (limit > 0 ? F.money(spent) + ' / ' + F.money(limit) : 'Sin límite') + '</span>' +
            '</div>' +

            // Barra de progreso
            (limit > 0
              ? '<div style="background:var(--surface-3);border-radius:var(--r-full);height:8px;margin:var(--sp-2) 0;overflow:hidden">' +
                  '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:var(--r-full);transition:width .4s ease"></div>' +
                '</div>' +
                '<div style="font-size:var(--fs-xs);color:' + (over ? 'var(--danger)' : 'var(--text-faint)') + '">' +
                  (over
                    ? '⚠ Superaste el límite por ' + F.money(spent - limit)
                    : pct + '% utilizado · te quedan ' + F.money(limit - spent)) +
                '</div>'
              : '<div style="font-size:var(--fs-xs);color:var(--text-faint)">Gastado este mes: ' + F.money(spent) + '</div>') +

            // Form para definir/editar límite
            '<form class="budget-form mt-2" data-cat="' + cat.key + '" novalidate>' +
              '<div class="row" style="gap:var(--sp-2);align-items:center">' +
                '<input class="input" type="number" min="1000" step="1000" ' +
                  'placeholder="Límite en $" value="' + (limit || '') + '" ' +
                  'style="max-width:160px">' +
                '<button class="btn btn-primary btn-sm" type="submit">' +
                  (budget ? 'Actualizar' : 'Fijar límite') +
                '</button>' +
              '</div>' +
            '</form>' +
          '</div>';
        }).join('') +
      '</div></div>';

    // Bind forms
    contentEl.querySelectorAll('.budget-form').forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cat = form.dataset.cat;
        const input = form.querySelector('input');
        const amount = parseInt(input.value, 10);
        if (!amount || amount < 1) { App.toast.warning('Ingresá un monto válido.'); return; }
        const btn = form.querySelector('button');
        App.ui.setLoading(btn, true, 'Guardando');
        try {
          await App.api.upsertBudget({ category: cat, amount, month: currentMonth });
          App.toast.success('Presupuesto guardado.');
          await load();
        } catch (err) {
          App.toast.error(err.message || 'Error al guardar.', 'Error');
        } finally {
          App.ui.setLoading(btn, false);
        }
      });
    });

    // Bind delete buttons
    contentEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.del;
        try {
          await App.api.deleteBudget(id);
          App.toast.success('Presupuesto eliminado.');
          await load();
        } catch (err) {
          App.toast.error(err.message || 'Error al eliminar.', 'Error');
        }
      });
    });
  }

  await load();
};
