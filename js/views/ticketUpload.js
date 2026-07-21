/* =============================================================
   Mango · views/ticketUpload.js — Carga por ticket (#/ticket)
   -------------------------------------------------------------
   Drag/drop or pick an image → preview → POST /tickets/upload
   (mocked OCR) → pre-fill the reusable expense form so the user
   can correct the detected merchant / amount / date before save.
   ============================================================= */

window.App = window.App || {};
App.views = App.views || {};

App.views.ticket = async function (container) {
  const { icon, esc, $ } = App.dom;
  const F = App.format;

  let fileURL = null;
  let queue   = [];   // cola de archivos pendientes de procesar
  let current = 0;    // índice del archivo que se está procesando

  container.innerHTML =
    '<div class="page-head"><div>' +
      '<div class="eyebrow">Carga inteligente</div>' +
      "<h1>Cargar por ticket</h1>" +
      '<p class="lede">Subí una foto del ticket y nuestro lector extrae el comercio, el monto y la fecha. Después podés corregir lo que haga falta.</p>' +
    "</div></div>" +
    '<div class="ticket-grid">' +
      '<div id="leftCol">' +
        '<label class="dropzone" id="dropzone" for="ticketInput">' +
          '<span class="dz-ico">' + icon("upload") + "</span>" +
          "<h3>Arrastrá tu ticket acá</h3>" +
          '<p class="muted">o hacé clic para elegir una o varias imágenes (JPG o PNG)</p>' +
          '<input type="file" id="ticketInput" accept="image/*" class="sr-only" multiple>' +
        "</label>" +
      "</div>" +
      '<div id="rightCol">' +
        '<div class="card"><div class="card-body" id="resultPanel">' +
          '<div class="empty" style="padding:var(--sp-7) var(--sp-4)">' +
            '<div class="empty-mark">' + icon("receipt") + "</div>" +
            "<p>Los datos detectados van a aparecer acá.</p></div>" +
        "</div></div>" +
      "</div>" +
    "</div>";

  const dz = $("#dropzone", container);
  const input = $("#ticketInput", container);
  const leftCol = $("#leftCol", container);
  const resultPanel = $("#resultPanel", container);

  // drag styling
  ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
  dz.addEventListener("drop", (e) => {
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    if (files.length === 1) { handleFile(files[0]); return; }
    queue = files; current = 0;
    showQueue();
  });
  input.addEventListener("change", (e) => {
    const files = Array.from(e.target.files).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    if (files.length === 1) { handleFile(files[0]); return; }
    // Múltiples archivos: mostrar panel de cola
    queue = files; current = 0;
    showQueue();
  });

  // ── Modo cola (múltiples tickets) ────────────────────────────

  function showQueue() {
    // Mostrar resumen de la cola en la columna izquierda
    leftCol.innerHTML =
      '<div class="card"><div class="card-head">' +
        '<h3>' + icon("receipt") + 'Tickets en cola</h3>' +
        '<span class="badge">' + current + ' de ' + queue.length + '</span>' +
      '</div><div class="card-body">' +
        '<div style="display:flex;flex-direction:column;gap:var(--sp-2)">' +
          queue.map((f, i) =>
            '<div style="display:flex;align-items:center;gap:var(--sp-2);padding:var(--sp-2);' +
            'border-radius:var(--r-sm);background:' +
            (i < current ? 'var(--primary-soft)' : i === current ? 'var(--surface-2)' : 'transparent') + '">' +
              '<span style="font-size:11px;color:var(--text-faint);width:20px;text-align:right">' + (i + 1) + '</span>' +
              '<span style="flex:1;font-size:var(--fs-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
                esc(f.name) +
              '</span>' +
              '<span>' +
                (i < current ? '✓' : i === current ? icon('sparkle') : '') +
              '</span>' +
            '</div>'
          ).join('') +
        '</div>' +
        '<button class="btn btn-soft btn-sm mt-4" id="cancelQueue">' + icon('x') + 'Cancelar cola</button>' +
      '</div></div>';

    $('#cancelQueue', leftCol).addEventListener('click', resetZone);

    // Procesar el primero
    processNext();
  }

  function processNext() {
    if (current >= queue.length) {
      // Todos procesados
      resultPanel.innerHTML =
        '<div class="empty">' +
          '<div class="empty-mark">' + icon('check') + '</div>' +
          '<h3>¡Todos los tickets procesados!</h3>' +
          '<p>' + queue.length + ' gastos guardados desde tus tickets.</p>' +
          '<a class="btn btn-primary mt-4" href="#/gastos">' + icon('list') + 'Ver mis gastos</a>' +
        '</div>';
      leftCol.innerHTML =
        '<div class="card"><div class="card-body" style="text-align:center;padding:var(--sp-6)">' +
          icon('check') + '<p class="mt-2">Cola completada</p>' +
          '<button class="btn btn-soft mt-4" id="newQueue">' + icon('upload') + 'Cargar más tickets</button>' +
        '</div></div>';
      $('#newQueue', leftCol).addEventListener('click', resetZone);
      return;
    }

    // Actualizar badge de progreso
    const badge = leftCol.querySelector('.badge');
    if (badge) badge.textContent = (current + 1) + ' de ' + queue.length;

    // Actualizar colores de la lista
    leftCol.querySelectorAll('[data-qi]') && leftCol.querySelectorAll('div > div > div').forEach((el, i) => {
      if (i < current) el.style.background = 'var(--primary-soft)';
      else if (i === current) el.style.background = 'var(--surface-2)';
      else el.style.background = 'transparent';
    });

    // Mostrar skeleton mientras procesa
    resultPanel.innerHTML =
      '<div class="row-between mb-4">' +
        '<div><h3 style="font-size:var(--fs-md)">Ticket ' + (current + 1) + ' de ' + queue.length + '</h3>' +
        '<p class="muted" style="font-size:var(--fs-sm)">' + esc(queue[current].name) + '</p></div>' +
        '<span class="extracted-tag">' + icon('sparkle') + 'Leyendo…</span>' +
      '</div>' +
      ocrSkeleton();

    runOcrQueued(queue[current]);
  }

  async function runOcrQueued(file) {
    try {
      const data = await App.api.uploadTicket(file);
      showFormQueued(data, file.name);
    } catch (err) {
      // Si falla un ticket, mostrar error y botón para saltar al siguiente
      resultPanel.innerHTML =
        '<div class="empty">' +
          '<div class="empty-mark">' + icon('alert') + '</div>' +
          '<p>No se pudo leer <strong>' + esc(file.name) + '</strong>.</p>' +
          '<button class="btn btn-soft mt-4" id="skipTicket">Saltar al siguiente</button>' +
        '</div>';
      const skipBtn = resultPanel.querySelector('#skipTicket');
      if (skipBtn) skipBtn.addEventListener('click', () => { current++; processNext(); });
      App.toast.warning('No se pudo leer "' + file.name + '". Podés saltarlo.');
    }
  }

  function showFormQueued(data, filename) {
    const conf = Math.round((data.confidence || 0.9) * 100);
    resultPanel.innerHTML =
      '<div class="row-between" style="margin-bottom:var(--sp-4)">' +
        '<div><h3 style="font-size:var(--fs-md)">Ticket ' + (current + 1) + ' de ' + queue.length + '</h3>' +
        '<p class="muted" style="font-size:var(--fs-sm)">' + esc(filename) + '</p></div>' +
        '<span class="extracted-tag">' + icon('sparkle') + conf + '% confianza</span>' +
      '</div>' +
      App.expenseForm.build(
        { merchant: data.merchant, amount: data.amount, category: data.category, date: data.date, description: data.description },
        { submitLabel: 'Guardar y continuar (' + (current + 1) + '/' + queue.length + ')' }
      );

    App.toast.success('Ticket ' + (current + 1) + ': ' + data.merchant + ' · ' + App.format.money(data.amount));

    App.expenseForm.bind(resultPanel, async (payload, form) => {
      const btn = form.querySelector('#ef-submit');
      App.ui.setLoading(btn, true, 'Guardando');
      try {
        await App.api.createExpense(payload);
        App.toast.success('Gasto ' + (current + 1) + ' guardado.');
        current++;
        processNext();
      } catch (err) {
        App.ui.setLoading(btn, false);
        App.toast.error(err.message || 'No se pudo guardar.', 'Error');
      }
    });
  }

  function handleFile(file) {
    if (!file.type.startsWith("image/")) { App.toast.warning("Subí un archivo de imagen (JPG o PNG)."); return; }
    if (fileURL) URL.revokeObjectURL(fileURL);
    fileURL = URL.createObjectURL(file);

    // show preview with scanning overlay
    leftCol.innerHTML =
      '<div class="ticket-preview">' +
        '<img src="' + fileURL + '" alt="Ticket">' +
        '<button class="btn btn-ghost btn-sm change" id="changeBtn">' + icon("camera") + "Cambiar</button>" +
        '<div class="ocr-overlay" id="ocrOverlay"><div class="scan-line"></div>' +
          '<span class="spinner lg"></span><span>Leyendo el ticket…</span></div>' +
      "</div>";
    $("#changeBtn", leftCol).addEventListener("click", resetZone);

    resultPanel.innerHTML = ocrSkeleton();
    runOcr(file);
  }

  async function runOcr(file) {
    try {
      const data = await App.api.uploadTicket(file);
      const overlay = $("#ocrOverlay", leftCol);
      if (overlay) overlay.remove();
      showForm(data);
    } catch (err) {
      const overlay = $("#ocrOverlay", leftCol);
      if (overlay) overlay.remove();
      resultPanel.innerHTML = '<div class="empty"><div class="empty-mark">' + icon("alert") + "</div><p>No se pudo leer el ticket. Probá con otra imagen o cargalo manualmente.</p>" +
        '<a class="btn btn-ghost mt-4" href="#/nuevo">Cargar manualmente</a></div>';
      App.toast.error("Falló la lectura del ticket.", "Error de OCR");
    }
  }

  function showForm(data) {
    const conf = Math.round((data.confidence || 0.9) * 100);
    resultPanel.innerHTML =
      '<div class="row-between" style="margin-bottom:var(--sp-4)">' +
        "<div><h3 style=\"font-size:var(--fs-md)\">Datos detectados</h3>" +
        '<p class="muted" style="font-size:var(--fs-sm)">Revisá y corregí antes de guardar.</p></div>' +
        '<span class="extracted-tag">' + icon("sparkle") + conf + "% confianza</span>" +
      "</div>" +
      App.expenseForm.build({ merchant: data.merchant, amount: data.amount, category: data.category, date: data.date, description: data.description },
        { submitLabel: "Guardar gasto" });

    App.toast.success("Detectamos " + F.money(data.amount) + " en " + data.merchant + ".", "Ticket leído");

    App.expenseForm.bind(resultPanel, async (payload, form) => {
      const btn = form.querySelector("#ef-submit");
      App.ui.setLoading(btn, true, "Guardando");
      try {
        await App.api.createExpense(payload);
        App.toast.success("Gasto guardado desde el ticket.");
        App.router.go("#/gastos");
      } catch (err) {
        App.ui.setLoading(btn, false);
        App.toast.error(err.message || "No se pudo guardar.", "Error");
      }
    });
  }

  function resetZone() {
    if (fileURL) { URL.revokeObjectURL(fileURL); fileURL = null; }
    App.views.ticket(container); // re-render fresh
  }

  function ocrSkeleton() {
    return '<div style="display:flex;flex-direction:column;gap:14px">' +
      '<div class="skel" style="height:13px;width:40%"></div>' +
      '<div class="skel" style="height:44px"></div>' +
      '<div class="skel" style="height:44px;width:70%"></div>' +
      '<div class="skel" style="height:44px"></div>' +
      "</div>";
  }
};
