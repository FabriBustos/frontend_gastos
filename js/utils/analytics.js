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
      totalThisMonth, totalPrevMonth, avgMonthly, deltaPct,
      byMonth, catList, merchantRanking, maxMerchantCount,
      anomalies, dominant, totalAll, count: expenses.length,
      monthValues: months.map((m) => byMonth[m]),
    };
  }

  return { compute, lastMonths };
})();
