/* =============================================================
   Mango · views/consultas.js — Mis consultas (#/consultas)
   -------------------------------------------------------------
   El cliente puede enviar una consulta al asesor y ver el
   historial de sus consultas con las respuestas recibidas.
   ============================================================= */

window.App = window.App || {};
App.views = App.views || {};

App.views.consultas = async function (container) {
  const { icon, esc, $ } = App.dom;
  const F = App.format;

  container.innerHTML =
    '<div class="page-head"><div>' +
      '<div class="eyebrow">Asesoría</div>' +
      '<h1>Consultas al asesor</h1>' +
      '<p class="lede">Enviá una consulta y recibí orientación financiera personalizada.</p>' +
    '</div></div>' +

    '<div class="card mb-6">' +
      '<div class="card-head"><h3>' + icon('sparkle') + 'Nueva consulta</h3></div>' +
      '<div class="card-body">' +
        '<form id="consultForm" novalidate>' +
          '<div class="field" id="f-question">' +
            '<label>Tu consulta</label>' +
            '<textarea class="input" id="c-question" rows="4" ' +
              'placeholder="Ej: ¿Cómo puedo reducir mis gastos en entretenimiento?"></textarea>' +
            '<span class="error-msg">' + icon('alert') + '<span></span></span>' +
          '</div>' +
          '<div class="row" style="justify-content:flex-end">' +
            '<button class="btn btn-primary" type="submit" id="c-send">' +
              icon('sparkle') + 'Enviar consulta' +
            '</button>' +
          '</div>' +
        '</form>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="card-head"><h3>Historial de consultas</h3>' +
        '<span class="badge" id="consultCount">…</span></div>' +
      '<div class="card-body" id="consultList">' +
        '<div class="loader-block"><span class="spinner lg"></span><span>Cargando…</span></div>' +
      '</div>' +
    '</div>';

  const listEl = $('#consultList', container);
  const form = $('#consultForm', container);
  const questionField = $('#f-question', container);

  // Cargar consultas existentes
  async function loadConsultations() {
    try {
      const data = await App.api.getMyConsultations();
      $('#consultCount', container).textContent = data.length;
      if (!data.length) {
        listEl.innerHTML = '<p class="muted center" style="font-size:var(--fs-sm)">Todavía no realizaste ninguna consulta.</p>';
        return;
      }
      listEl.innerHTML = data.map((c) =>
        '<div class="reco-item">' +
          '<div class="r-top">' +
            (c.answer ? icon('check') : icon('alert')) +
            '<strong>' + esc(c.question) + '</strong>' +
            '<span class="r-date">' + F.date(c.createdAt.slice(0, 10)) + '</span>' +
          '</div>' +
          (c.answer
            ? '<div class="mt-2" style="padding:var(--sp-3);background:var(--surface-2);border-radius:var(--radius-sm)">' +
                '<div class="eyebrow mb-1">Respuesta del asesor · ' + F.date(c.answeredAt.slice(0, 10)) + '</div>' +
                '<p>' + esc(c.answer) + '</p>' +
              '</div>'
            : '<p class="muted" style="font-size:var(--fs-sm);margin-top:var(--sp-2)">' +
                icon('clock') + ' Pendiente de respuesta' +
              '</p>') +
        '</div>'
      ).join('');
    } catch (err) {
      listEl.innerHTML = '<p class="muted">No se pudieron cargar las consultas.</p>';
      App.toast.error(err.message || 'Error al cargar consultas.', 'Error');
    }
  }

  await loadConsultations();

  // Enviar consulta
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = $('#c-question', form).value.trim();
    const ok = App.validate.form({
      question: { el: questionField, value: question,
        rules: [App.validate.rules.required, App.validate.rules.min(10)] },
    });
    if (!ok) return;
    const btn = $('#c-send', form);
    App.ui.setLoading(btn, true, 'Enviando');
    try {
      await App.api.createConsultation(question);
      $('#c-question', form).value = '';
      App.toast.success('Consulta enviada. El asesor te responderá pronto.');
      await loadConsultations();
    } catch (err) {
      App.toast.error(err.message || 'No se pudo enviar la consulta.', 'Error');
    } finally {
      App.ui.setLoading(btn, false);
    }
  });
};
