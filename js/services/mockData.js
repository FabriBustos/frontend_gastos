/* =============================================================
   Mango · mockData.js
   -------------------------------------------------------------
   In-memory dataset that lets the whole app run with no backend.
   api.js reads & mutates these structures when USE_MOCK = true.
   ============================================================= */

window.App = window.App || {};

App.mock = (function () {
  /* ---- Categories (keys map to CSS --cat-* tokens) ---------- */
  const CATEGORIES = [
    { key: "comida",          label: "Comida",          icon: "utensils" },
    { key: "transporte",      label: "Transporte",      icon: "car" },
    { key: "servicios",       label: "Servicios",       icon: "bolt" },
    { key: "entretenimiento", label: "Entretenimiento", icon: "play" },
    { key: "salud",           label: "Salud",           icon: "heart" },
    { key: "compras",         label: "Compras",         icon: "bag" },
    { key: "educacion",       label: "Educación",       icon: "book" },
    { key: "otros",           label: "Otros",           icon: "dots" },
  ];

  /* Realistic Argentine merchants grouped by category. */
  const MERCHANTS = {
    comida:          ["Coto", "Carrefour", "Disco", "La Anónima", "Rappi", "PedidosYa", "Havanna", "Starbucks"],
    transporte:      ["YPF", "Shell", "Axion", "SUBE", "Cabify", "Uber", "Estación Subte"],
    servicios:       ["Edenor", "Metrogas", "Aysa", "Movistar", "Personal", "Telecentro", "Fibertel"],
    entretenimiento: ["Netflix", "Spotify", "Disney+", "Cinemark", "Steam", "HBO Max"],
    salud:           ["Farmacity", "Farmacia del Pueblo", "OSDE", "Swiss Medical", "Galeno"],
    compras:         ["Mercado Libre", "Falabella", "Frávega", "Garbarino", "Dexter", "Zara"],
    educacion:       ["Coursera", "Platzi", "UTN", "Librería Cúspide", "Domestika"],
    otros:           ["Mercado Pago", "Banco Galicia", "Western Union", "Kiosco"],
  };

  /* ---- Users ------------------------------------------------ */
  const USERS = [
    { id: "u1", name: "Juan Pérez",      email: "juan@mango.app",    password: "123456", role: "user",    joined: "2024-08-12", phone: "+54 11 5555 1234", city: "Buenos Aires" },
    { id: "u2", name: "Sofía Ramírez",   email: "sofia@mango.app",   password: "123456", role: "user",    joined: "2024-10-03", phone: "+54 11 5555 8821", city: "Córdoba" },
    { id: "u3", name: "Martín Gómez",    email: "martin@mango.app",  password: "123456", role: "user",    joined: "2025-01-20", phone: "+54 11 5555 4410", city: "Rosario" },
    { id: "u4", name: "Lucía Fernández", email: "lucia@mango.app",   password: "123456", role: "user",    joined: "2025-03-11", phone: "+54 11 5555 9077", city: "Mendoza" },
    { id: "a1", name: "Valeria Soto",    email: "asesor@mango.app",  password: "123456", role: "advisor", joined: "2024-05-01", phone: "+54 11 5555 0001", city: "Buenos Aires" },
  ];

  /* ---- Deterministic pseudo-random generator ---------------- */
  function seeded(seed) {
    let s = seed;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }
  const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
  const between = (min, max, r) => Math.round((min + r() * (max - min)));

  /* Typical spend ranges per category (ARS) */
  const RANGES = {
    comida: [2500, 28000], transporte: [1200, 18000], servicios: [6000, 42000],
    entretenimiento: [2400, 9500], salud: [3000, 55000], compras: [8000, 120000],
    educacion: [9000, 60000], otros: [1500, 35000],
  };
  const DESCRIPTIONS = {
    comida: ["Compra semanal", "Almuerzo", "Cena con amigos", "Café", "Delivery", "Supermercado"],
    transporte: ["Carga de nafta", "Carga SUBE", "Viaje", "Peaje", "Estacionamiento"],
    servicios: ["Factura mensual", "Abono internet", "Plan celular", "Luz", "Gas"],
    entretenimiento: ["Suscripción mensual", "Entradas cine", "Juego", "Streaming"],
    salud: ["Farmacia", "Cuota prepaga", "Consulta", "Medicamentos"],
    compras: ["Compra online", "Ropa", "Electrodoméstico", "Regalo", "Calzado"],
    educacion: ["Curso online", "Cuota facultad", "Libros", "Material de estudio"],
    otros: ["Transferencia", "Comisión", "Varios", "Gasto eventual"],
  };

  /* Build an expense history for a user across the last `months`. */
  function buildExpenses(userId, seed, perMonth, recentBias) {
    const r = seeded(seed);
    const out = [];
    const now = new Date(2026, 4, 28); // fixed "today" for stable demo (May 28 2026)
    let idc = 0;
    for (let m = 5; m >= 0; m--) {
      const count = perMonth + between(-2, 3, r);
      for (let i = 0; i < count; i++) {
        const cat = pick(CATEGORIES, r).key;
        const day = between(1, 27, r);
        const d = new Date(now.getFullYear(), now.getMonth() - m, day);
        const [lo, hi] = RANGES[cat];
        let amount = between(lo, hi, r);
        // inject a few unusually large expenses in the most recent month
        if (recentBias && m === 0 && r() > 0.82) amount = Math.round(amount * (2.4 + r()));
        out.push({
          id: userId + "-e" + (idc++),
          userId,
          merchant: pick(MERCHANTS[cat], r),
          category: cat,
          amount,
          date: d.toISOString().slice(0, 10),
          description: pick(DESCRIPTIONS[cat], r),
        });
      }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }

  const EXPENSES = [
    ...buildExpenses("u1", 4231, 11, true),
    ...buildExpenses("u2", 9988, 9, true),
    ...buildExpenses("u3", 1507, 13, false),
    ...buildExpenses("u4", 7321, 7, true),
  ];

  return {
    categories: CATEGORIES,
    merchants: MERCHANTS,
    users: USERS,
    expenses: EXPENSES,
    catLabel: (k) => (CATEGORIES.find((c) => c.key === k) || {}).label || k,
  };
})();
