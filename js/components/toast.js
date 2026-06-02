/* =============================================================
   Mango · components/toast.js — transient notifications
   App.toast.success / error / warning / info (message, title?)
   ============================================================= */

window.App = window.App || {};

App.toast = (function () {
  const { icon, esc } = App.dom;
  let stack = null;

  function ensure() {
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    return stack;
  }

  const ICONS = { success: "checkCircle", error: "alert", warning: "alert", info: "info" };

  function show(type, message, title, timeout) {
    ensure();
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.setAttribute("role", "status");
    el.innerHTML =
      '<span class="t-ico">' + icon(ICONS[type] || "info") + "</span>" +
      '<div class="t-body">' +
        (title ? "<strong>" + esc(title) + "</strong>" : "") +
        "<span>" + esc(message) + "</span>" +
      "</div>" +
      '<button class="t-close" aria-label="Cerrar">' + icon("x") + "</button>";

    const close = () => {
      el.classList.add("out");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    };
    el.querySelector(".t-close").addEventListener("click", close);
    stack.appendChild(el);
    setTimeout(close, timeout || 4200);
    return el;
  }

  return {
    success: (m, t) => show("success", m, t),
    error: (m, t) => show("error", m, t),
    warning: (m, t) => show("warning", m, t),
    info: (m, t) => show("info", m, t),
  };
})();
