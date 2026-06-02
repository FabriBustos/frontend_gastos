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
          '<p class="muted">o hacé clic para elegir una imagen (JPG o PNG)</p>' +
          '<input type="file" id="ticketInput" accept="image/*" class="sr-only">' +
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
  dz.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
  input.addEventListener("change", (e) => { const f = e.target.files[0]; if (f) handleFile(f); });

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
