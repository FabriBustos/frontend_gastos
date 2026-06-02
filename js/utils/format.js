/* =============================================================
   Mango · utils/format.js — currency (ARS) & date formatting
   ============================================================= */

window.App = window.App || {};

App.format = (function () {
  const cfg = App.config;

  const ars = new Intl.NumberFormat(cfg.LOCALE, {
    style: "currency", currency: cfg.CURRENCY, maximumFractionDigits: 0,
  });
  const arsCents = new Intl.NumberFormat(cfg.LOCALE, {
    style: "currency", currency: cfg.CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const num = new Intl.NumberFormat(cfg.LOCALE, { maximumFractionDigits: 0 });

  /* $1.234.567 — Argentine peso, no decimals by default. */
  function money(value, withCents) {
    const n = Number(value) || 0;
    return (withCents ? arsCents : ars).format(n);
  }
  function plain(value) { return num.format(Number(value) || 0); }

  /* "12 mar 2026" */
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function parse(d) { const [y, m, day] = String(d).split("-").map(Number); return new Date(y, m - 1, day); }

  function date(d) {
    const dt = parse(d);
    return dt.getDate() + " " + MONTHS[dt.getMonth()] + " " + dt.getFullYear();
  }
  function dateShort(d) { const dt = parse(d); return String(dt.getDate()).padStart(2, "0") + "/" + String(dt.getMonth() + 1).padStart(2, "0"); }
  function monthLabel(key) { const [y, m] = key.split("-").map(Number); return MONTHS[m - 1] + " " + String(y).slice(2); }
  function monthLong(d) { const dt = parse(d); return MONTHS_LONG[dt.getMonth()] + " " + dt.getFullYear(); }

  /* "hace 3 días" relative-ish label, anchored to demo "today". */
  function relative(d) {
    const today = new Date(2026, 4, 28);
    const dt = parse(d);
    const days = Math.round((today - dt) / 86400000);
    if (days <= 0) return "hoy";
    if (days === 1) return "ayer";
    if (days < 7) return "hace " + days + " días";
    if (days < 30) return "hace " + Math.floor(days / 7) + " sem";
    return date(d);
  }

  function initials(name) {
    return String(name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
  }

  return { money, plain, date, dateShort, monthLabel, monthLong, relative, initials, parse, MONTHS };
})();
