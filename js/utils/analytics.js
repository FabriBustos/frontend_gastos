/* =============================================================
   Mango · utils/analytics.js
   -------------------------------------------------------------
   Pure functions that turn a flat list of expenses into the
   aggregates the dashboard and advisor panel render. No DOM,
   no side effects — easy to reason about and reuse.
   ============================================================= */

window.App = window.App || {};

App.analytics = (function () {
  const TODAY = new Date(2026, 4, 28);

  function ym(dateStr) { return dateStr.slice(0, 7); } // "2026-05"
  function sum(list) { return list.reduce((a, e) => a + e.amount, 0); }

  /* last N month keys ending at current month, oldest first */
  function lastMonths(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1);
      out.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
    }
    return out;
  }

  function compute(expenses) {
    const months = lastMonths(6);
    const curKey = months[months.length - 1];
    const prevKey = months[months.length - 2];

    const byMonth = {};
    months.forEach((m) => (byMonth[m] = 0));
    const byCat = {};
    const byMerchant = {};

    expenses.forEach((e) => {
      const k = ym(e.date);
      if (k in byMonth) byMonth[k] += e.amount;
      byCat[e.category] = (byCat[e.category] || 0) + e.amount;
      if (!byMerchant[e.merchant]) byMerchant[e.merchant] = { merchant: e.merchant, total: 0, count: 0 };
      byMerchant[e.merchant].total += e.amount;
      byMerchant[e.merchant].count++;
    });

    const totalThisMonth = byMonth[curKey] || 0;
    const totalPrevMonth = byMonth[prevKey] || 0;

    /* average over months that actually have data */
    const activeMonths = months.filter((m) => byMonth[m] > 0);
    const avgMonthly = activeMonths.length ? Math.round(months.reduce((a, m) => a + byMonth[m], 0) / Math.max(activeMonths.length, 1)) : 0;

    // Promedio semanal: total de los últimos 6 meses dividido por las semanas transcurridas
    const _now = new Date();
    const sixMonthsAgo = new Date(_now.getFullYear(), _now.getMonth() - 6, 1);
    const recentExpenses = expenses.filter((e) => new Date(e.date) >= sixMonthsAgo);
    const weeksCovered = Math.max(1, Math.round((_now - sixMonthsAgo) / (7 * 24 * 60 * 60 * 1000)));
    const avgWeekly = recentExpenses.length
      ? Math.round(recentExpenses.reduce((s, e) => s + e.amount, 0) / weeksCovered)
      : 0;

    const deltaPct = totalPrevMonth ? Math.round(((totalThisMonth - totalPrevMonth) / totalPrevMonth) * 100) : 0;

    const catList = Object.entries(byCat)
      .map(([key, total]) => ({ key, total, label: App.mock.catLabel(key) }))
      .sort((a, b) => b.total - a.total);
    const totalAll = sum(expenses);
    catList.forEach((c) => (c.pct = totalAll ? Math.round((c.total / totalAll) * 100) : 0));

    const merchantRanking = Object.values(byMerchant)
      .sort((a, b) => b.count - a.count || b.total - a.total)
      .slice(0, 6);
    const maxMerchantCount = merchantRanking.length ? merchantRanking[0].count : 1;

    /* anomalies: expenses far above the mean of their own category (this month) */
    const catStats = {};
    expenses.forEach((e) => {
      (catStats[e.category] = catStats[e.category] || []).push(e.amount);
    });
    const catMean = {};
    for (const k in catStats) catMean[k] = catStats[k].reduce((a, b) => a + b, 0) / catStats[k].length;
    const anomalies = expenses
      .filter((e) => ym(e.date) === curKey && e.amount > catMean[e.category] * 2.1 && e.amount > 30000)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);

    const dominant = catList[0] || null;

    return {
      months, curKey, prevKey,
      totalThisMonth, totalPrevMonth, avgMonthly, avgWeekly, deltaPct,
      byMonth, catList, merchantRanking, maxMerchantCount,
      anomalies, dominant, totalAll, count: expenses.length,
      monthValues: months.map((m) => byMonth[m]),
    };
  }

  /**
   * Clasifica el perfil financiero de un usuario según sus gastos.
   * Retorna { label, description, badge } donde badge es una clase CSS.
   */
  function classifyProfile(expenses) {
    if (!expenses.length) return { label: 'Sin datos', description: 'No hay suficientes gastos para clasificar.', badge: 'neutral' };

    const a = compute(expenses);
    const now = new Date(2026, 4, 28);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().slice(0, 7);
    const recent = expenses.filter((e) => e.date.slice(0, 7) >= sixMonthsAgo);
    const anomalyRate = recent.length ? a.anomalies.length / recent.length : 0;
    const monthlyGrowth = a.totalPrevMonth > 0 ? (a.totalThisMonth - a.totalPrevMonth) / a.totalPrevMonth : 0;

    // Comportamiento problemático: muchas anomalías o crecimiento acelerado
    if (anomalyRate > 0.15 || monthlyGrowth > 0.4) {
      return {
        label: 'Consumidor impulsivo',
        description: 'Presenta gastos inusuales frecuentes o un aumento acelerado del gasto mensual. Se recomienda revisar sus hábitos.',
        badge: 'danger',
        problematic: true,
      };
    }
    // Ahorrador: gasto promedio bajo y sin anomalías
    if (a.avgMonthly < 30000 && anomalyRate === 0) {
      return {
        label: 'Consumidor ahorrador',
        description: 'Gasto mensual bajo y controlado. Sin comportamientos fuera de lo habitual.',
        badge: 'success',
        problematic: false,
      };
    }
    // Equilibrado
    return {
      label: 'Consumidor equilibrado',
      description: 'Gasto mensual moderado sin comportamientos alarmantes.',
      badge: 'info',
      problematic: false,
    };
  }

  return { compute, lastMonths, classifyProfile };
})();
