/* =============================================================
   Mango · views/metas.js — Metas de ahorro (#/metas)
   -------------------------------------------------------------
   El usuario define objetivos de ahorro con monto y fecha límite.
   Puede registrar depósitos parciales y seguir su progreso.
   ============================================================= */

window.App = window.App || {};
App.views = App.views || {};

App.views.metas = async function (container) {
  const { icon, esc, $ } = App.dom;
  const F = App.format;

  container.innerHTML =
    '<div class="page-head"><div>' +
      '<div class="eyebrow">Finanzas</div>' +
      '<h1>Metas de ahorro</h1>' +
      '<p class="lede">Definí tus objetivos financieros y seguí tu progreso hacia ellos.</p>' +
    '</div></div>' +

    // Form nueva meta
    '<div class="card mb-6"><div class="card-head"><h3>' + icon('target') + 'Nueva meta</h3></div>' +
    '<div class="card-body"><form id="goalForm" novalidate>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4)">' +
        '<div class="field" style="grid-column:1/-1"><label>Nombre de la meta</label>' +
          '<input class="input" id="g-title" placeholder="Ej: Viaje a Europa, Notebook nueva…"></div>' +
        '<div class="field"><label>Monto objetivo ($)</label>' +
          '<input class="input" type="number" id="g-amount" min="1000" step="1000" placeholder="1000000"></div>' +
        '<div class="field"><label>Fecha límite</label>' +
          '<input class="input" type="date" id="g-deadline"></div>' +
      '</div>' +
      '<div class="row" style="justify-content:flex-end">' +
        '<button class="btn btn-primary" type="submit" id="g-submit">' + icon('plus') + 'Crear meta</button>' +
      '</div>' +
    '</form></div></div>' +

    // Lista de metas
    '<div id="goalsList"><div class="loader-block"><span class="spinner lg"></span><span>Cargando…</span></div></div>';

  const listEl = $('#goalsList', container);

  async function load() {
    try {
      const goals = await App.api.getGoals();
      render(goals);
    } catch (err) {
      listEl.innerHTML = '<p class="muted">No se pudieron cargar las metas.</p>';
      App.toast.error(err.message || 'Error al cargar.', 'Error');
    }
  }

  function render(goals) {
    if (!goals.length) {
      listEl.innerHTML =
        '<div class="card"><div class="empty">' +
          '<div class="empty-mark">' + icon('target') + '</div>' +
          '<h3>Sin metas todavía</h3>' +
          '<p>Creá tu primera meta de ahorro arriba.</p>' +
        '</div></div>';
      return;
    }

    const active    = goals.filter((g) => !g.completed);
    const completed = goals.filter((g) => g.completed);

    listEl.innerHTML =
      (active.length ? '<div class="section-title mb-3">En progreso (' + active.length + ')</div>' : '') +
      active.map((g) => goalCard(g)).join('') +
      (completed.length ? '<div class="section-title mt-6 mb-3">Completadas (' + completed.length + ')</div>' : '') +
      completed.map((g) => goalCard(g)).join('');

    // Bind deposit forms
    listEl.querySelectorAll('.deposit-form').forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = form.dataset.id;
        const input = form.querySelector('input');
        const amount = parseInt(input.value, 10);
        if (!amount || amount < 1) { App.toast.warning('Ingresá un monto válido.'); return; }
        const btn = form.querySelector('button');
        App.ui.setLoading(btn, true, 'Guardando');
        try {
          await App.api.addSavings(id, amount);
          App.toast.success('¡Ahorro registrado!');
          await load();
        } catch (err) {
          App.toast.error(err.message || 'Error.', 'Error');
        } finally {
          App.ui.setLoading(btn, false);
        }
      });
    });

    // Bind delete buttons
    listEl.querySelectorAll('[data-del-goal]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.delGoal;
        try {
          await App.api.deleteGoal(id);
          App.toast.success('Meta eliminada.');
          await load();
        } catch (err) {
          App.toast.error(err.message || 'Error.', 'Error');
        }
      });
    });
  }

  function goalCard(g) {
    const pct       = Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100));
    const remaining = Math.max(0, g.targetAmount - g.savedAmount);
    const barColor  = g.completed ? 'var(--primary)' : pct >= 75 ? 'var(--warning)' : 'var(--primary)';

    // Días restantes
    const today    = new Date();
    const deadline = new Date(g.deadline);
    const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    const daysLabel = g.completed
      ? '✓ Completada'
      : daysLeft < 0
        ? 'Venció hace ' + Math.abs(daysLeft) + ' días'
        : daysLeft === 0
          ? '¡Vence hoy!'
          : daysLeft + ' días restantes';

    return '<div class="reco-item">' +
      '<div class="r-top">' +
        icon(g.completed ? 'check' : 'target') +
        '<strong>' + esc(g.title) + '</strong>' +
        '<span class="r-date">' + F.date(g.deadline) + '</span>' +
        '<span class="badge" style="cursor:pointer;color:var(--danger)" data-del-goal="' + g.id + '">✕</span>' +
      '</div>' +

      // Barra de progreso
      '<div style="background:var(--surface-3);border-radius:var(--r-full);height:10px;margin:var(--sp-3) 0 var(--sp-2);overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:var(--r-full);transition:width .4s ease"></div>' +
      '</div>' +

      // Stats
      '<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:var(--text-2);margin-bottom:var(--sp-3)">' +
        '<span>' + F.money(g.savedAmount) + ' ahorrados de ' + F.money(g.targetAmount) + '</span>' +
        '<span>' + pct + '%</span>' +
      '</div>' +

      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--sp-2)">' +
        '<span style="font-size:var(--fs-xs);color:' + (daysLeft < 0 && !g.completed ? 'var(--danger)' : 'var(--text-faint)') + '">' +
          daysLabel +
          (!g.completed && remaining > 0 ? ' · Te faltan ' + F.money(remaining) : '') +
        '</span>' +

        // Form de depósito (solo si no está completada)
        (!g.completed
          ? '<form class="deposit-form row" data-id="' + g.id + '" style="gap:var(--sp-2)" novalidate>' +
              '<input class="input" type="number" min="100" step="100" placeholder="Depositar $" style="max-width:140px">' +
              '<button class="btn btn-primary btn-sm" type="submit">' + icon('plus') + 'Registrar</button>' +
            '</form>'
          : '<span class="badge" style="background:var(--primary-soft);color:var(--primary-strong)">🎉 ¡Meta alcanzada!</span>') +
      '</div>' +
    '</div>';
  }

  // Form nueva meta
  $('#goalForm', container).addEventListener('submit', async (e) => {
    e.preventDefault();
    const title        = $('#g-title', container).value.trim();
    const targetAmount = parseInt($('#g-amount', container).value, 10);
    const deadline     = $('#g-deadline', container).value;

    if (!title || title.length < 3)   { App.toast.warning('El nombre debe tener al menos 3 caracteres.'); return; }
    if (!targetAmount || targetAmount < 1000) { App.toast.warning('El monto debe ser al menos $1.000.'); return; }
    if (!deadline) { App.toast.warning('Seleccioná una fecha límite.'); return; }

    const btn = $('#g-submit', container);
    App.ui.setLoading(btn, true, 'Creando');
    try {
      await App.api.createGoal({ title, targetAmount, deadline });
      App.toast.success('¡Meta creada!');
      $('#g-title', container).value = '';
      $('#g-amount', container).value = '';
      $('#g-deadline', container).value = '';
      await load();
    } catch (err) {
      App.toast.error(err.message || 'Error al crear.', 'Error');
    } finally {
      App.ui.setLoading(btn, false);
    }
  });

  await load();
};
