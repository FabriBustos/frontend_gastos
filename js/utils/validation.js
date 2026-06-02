/* =============================================================
   Mango · utils/validation.js
   -------------------------------------------------------------
   Pure validation rules + a tiny form-validation runner that
   wires error messages into .field markup (see components.css).
   ============================================================= */

window.App = window.App || {};

App.validate = (function () {
  const rules = {
    required: (v) => (v != null && String(v).trim() !== "") || "Este campo es obligatorio.",
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()) || "Ingresá un email válido.",
    min: (len) => (v) => String(v).length >= len || ("Mínimo " + len + " caracteres."),
    money: (v) => (Number(v) > 0) || "Ingresá un monto mayor a 0.",
    date: (v) => (!!v && !isNaN(App.format.parse(v))) || "Elegí una fecha válida.",
    notFuture: (v) => (App.format.parse(v) <= new Date(2026, 4, 28)) || "La fecha no puede ser futura.",
    match: (otherGetter, msg) => (v) => v === otherGetter() || (msg || "Los valores no coinciden."),
  };

  /* Estimate password strength 0..4 for the meter UI. */
  function passwordStrength(pw) {
    let s = 0;
    if (!pw) return 0;
    if (pw.length >= 6) s++;
    if (pw.length >= 10) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(s, 4);
  }

  /* Validate a single field element against an array of rule fns.
     Returns true/false and toggles .invalid + .error-msg text. */
  function field(fieldEl, value, ruleFns) {
    for (const fn of ruleFns) {
      const res = fn(value);
      if (res !== true) {
        fieldEl.classList.add("invalid");
        const msg = fieldEl.querySelector(".error-msg");
        if (msg) msg.lastChild ? (msg.lastChild.textContent = res) : (msg.textContent = res);
        return false;
      }
    }
    fieldEl.classList.remove("invalid");
    return true;
  }

  /* Validate a whole form given a spec: { name: { el, value, rules } } */
  function form(spec) {
    let ok = true;
    let firstBad = null;
    for (const key in spec) {
      const { el, value, rules: rfs } = spec[key];
      const valid = field(el, typeof value === "function" ? value() : value, rfs);
      if (!valid) { ok = false; if (!firstBad) firstBad = el; }
    }
    if (firstBad) { const input = firstBad.querySelector("input,select,textarea"); if (input) input.focus(); }
    return ok;
  }

  return { rules, field, form, passwordStrength };
})();
