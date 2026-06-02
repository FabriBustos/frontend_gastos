/* =============================================================
   Mango · components/modal.js
   -------------------------------------------------------------
   App.modal.open({ title, subtitle, body, footer, wide, icon })
     -> returns { close, root }
   App.modal.confirm({ title, message, confirmText, danger })
     -> returns a Promise<boolean>
   Closes on backdrop click, the X button, or Escape.
   ============================================================= */

window.App = window.App || {};

App.modal = (function () {
  const { icon, esc } = App.dom;
  let openCount = 0;

  function open(opts) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal" + (opts.wide ? " wide" : "");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    modal.innerHTML =
      '<div class="modal-head">' +
        "<div>" +
          (opts.icon ? '<div class="modal-icon ' + (opts.iconKind || "") + '">' + icon(opts.icon) + "</div>" : "") +
          "<h3>" + esc(opts.title || "") + "</h3>" +
          (opts.subtitle ? "<p>" + esc(opts.subtitle) + "</p>" : "") +
        "</div>" +
        (opts.dismissable === false ? "" : '<button class="modal-x" aria-label="Cerrar">' + icon("x") + "</button>") +
      "</div>" +
      '<div class="modal-body"></div>' +
      '<div class="modal-foot"></div>';

    const bodyEl = modal.querySelector(".modal-body");
    const footEl = modal.querySelector(".modal-foot");
    if (typeof opts.body === "string") bodyEl.innerHTML = opts.body;
    else if (opts.body) bodyEl.appendChild(opts.body);
    if (!opts.body) bodyEl.remove();

    if (opts.footer) {
      if (typeof opts.footer === "string") footEl.innerHTML = opts.footer;
      else footEl.appendChild(opts.footer);
    } else { footEl.remove(); }

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";
    openCount++;

    function close() {
      backdrop.remove();
      if (--openCount <= 0) { document.body.style.overflow = ""; openCount = 0; }
      document.removeEventListener("keydown", onKey);
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) { if (e.key === "Escape" && opts.dismissable !== false) close(); }

    const xBtn = modal.querySelector(".modal-x");
    if (xBtn) xBtn.addEventListener("click", close);
    backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop && opts.dismissable !== false) close(); });
    document.addEventListener("keydown", onKey);

    // focus first focusable
    setTimeout(() => { const f = modal.querySelector("input,select,textarea,button"); if (f) f.focus(); }, 30);

    return { close, root: modal, bodyEl, footEl };
  }

  /* Promise-based confirm dialog. */
  function confirm(opts) {
    return new Promise((resolve) => {
      let decided = false;
      const m = open({
        title: opts.title || "¿Confirmás?",
        subtitle: opts.message,
        icon: opts.danger ? "alert" : "info",
        iconKind: opts.danger ? "danger" : "",
        footer:
          '<button class="btn btn-ghost" data-act="cancel">' + esc(opts.cancelText || "Cancelar") + "</button>" +
          '<button class="btn ' + (opts.danger ? "btn-danger" : "btn-primary") + '" data-act="ok">' + esc(opts.confirmText || "Confirmar") + "</button>",
        onClose: () => { if (!decided) resolve(false); },
      });
      m.footEl.querySelector('[data-act="cancel"]').addEventListener("click", () => { decided = true; m.close(); resolve(false); });
      m.footEl.querySelector('[data-act="ok"]').addEventListener("click", () => { decided = true; m.close(); resolve(true); });
    });
  }

  return { open, confirm };
})();
