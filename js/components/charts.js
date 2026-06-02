/* =============================================================
   Mango · components/charts.js
   -------------------------------------------------------------
   Thin wrappers over Chart.js. Colors are pulled from the live
   CSS custom properties so charts respect light/dark + the
   category palette. Each factory returns the Chart instance so
   callers can destroy() it on view teardown.
   ============================================================= */

window.App = window.App || {};

App.charts = (function () {
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function catColor(key) { return cssVar("--cat-" + key) || cssVar("--text-faint"); }

  function baseFont() { return getComputedStyle(document.body).fontFamily; }

  function commonOpts() {
    const grid = cssVar("--border");
    const text = cssVar("--text-muted");
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      gridColor: grid, tickColor: text,
    };
  }

  /* Doughnut: spend by category. */
  function categoryPie(canvas, catList) {
    const data = catList.filter((c) => c.total > 0);
    return new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: data.map((c) => c.label),
        datasets: [{
          data: data.map((c) => c.total),
          backgroundColor: data.map((c) => catColor(c.key)),
          borderColor: cssVar("--surface"),
          borderWidth: 3,
          hoverOffset: 8,
        }],
      },
      options: {
        ...commonOpts(),
        cutout: "62%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => " " + ctx.label + ": " + App.format.money(ctx.parsed) },
            backgroundColor: cssVar("--text"), titleColor: cssVar("--surface"),
            bodyColor: cssVar("--surface"), padding: 10, cornerRadius: 8, displayColors: false,
            bodyFont: { family: baseFont() },
          },
        },
      },
    });
  }

  /* Vertical bars: spend per month. */
  function monthlyBars(canvas, months, values) {
    const primary = cssVar("--primary");
    const soft = cssVar("--surface-3");
    const lastIdx = values.length - 1;
    return new Chart(canvas, {
      type: "bar",
      data: {
        labels: months.map((m) => App.format.monthLabel(m)),
        datasets: [{
          data: values,
          backgroundColor: values.map((_, i) => (i === lastIdx ? primary : soft)),
          hoverBackgroundColor: primary,
          borderRadius: 8,
          maxBarThickness: 46,
        }],
      },
      options: {
        ...commonOpts(),
        scales: {
          x: { grid: { display: false }, border: { display: false },
               ticks: { color: cssVar("--text-muted"), font: { family: baseFont(), size: 12 } } },
          y: { grid: { color: cssVar("--border") }, border: { display: false },
               ticks: { color: cssVar("--text-faint"), font: { family: baseFont(), size: 11 },
                        callback: (v) => "$" + (v >= 1000 ? (v / 1000) + "k" : v) }, beginAtZero: true },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => " " + App.format.money(ctx.parsed.y) },
            backgroundColor: cssVar("--text"), titleColor: cssVar("--surface"),
            bodyColor: cssVar("--surface"), padding: 10, cornerRadius: 8, displayColors: false,
            bodyFont: { family: baseFont() }, titleFont: { family: baseFont() },
          },
        },
      },
    });
  }

  return { categoryPie, monthlyBars, catColor };
})();
