/* =============================================================
   Mango · api.js
   -------------------------------------------------------------
   Thin service layer. Every view talks to the backend ONLY
   through this object — never via fetch() directly.

   • request()  : wrapper around fetch() that attaches the JWT
                  from localStorage and normalises errors.
   • When App.config.USE_MOCK is true, requests are resolved
     against the in-memory dataset (App.mock) with simulated
     latency, so the SPA is fully navigable with zero backend.

   Endpoints consumed (REST):
     POST   /auth/login      POST /auth/register
     GET    /expenses        POST /expenses
     PUT    /expenses/:id    DELETE /expenses/:id
     POST   /tickets/upload
   (plus advisor helpers: GET /users, POST /recommendations)
   ============================================================= */

window.App = window.App || {};

App.api = (function () {
  const cfg = App.config;

  /* -------- token helpers -------- */
  function getToken() { return localStorage.getItem(cfg.TOKEN_KEY); }

  /* Encode/decode a *fake* JWT for the mock layer (header.payload.sig). */
  function fakeJwt(payload) {
    const b64 = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
    return b64({ alg: "HS256", typ: "JWT" }) + "." + b64(payload) + ".mock-signature";
  }
  function decodeJwt(token) {
    try { return JSON.parse(decodeURIComponent(escape(atob(token.split(".")[1])))); }
    catch (e) { return null; }
  }

  /* -------- mock persistence (so added/edited data survives reload) -------- */
  const DB_KEY = "mango.db";
  let db = null;
  function loadDb() {
    if (db) return db;
    const saved = localStorage.getItem(DB_KEY);
    if (saved) { try { db = JSON.parse(saved); return db; } catch (e) {} }
    db = {
      expenses: App.mock.expenses.map((e) => ({ ...e })),
      recommendations: [],
    };
    saveDb();
    return db;
  }
  function saveDb() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* A thrown ApiError carries a friendly message + status. */
  function ApiError(message, status) { this.message = message; this.status = status; this.name = "ApiError"; }
  ApiError.prototype = Object.create(Error.prototype);

  /* =========================================================
     REAL transport — used when USE_MOCK = false
     ========================================================= */
  async function realRequest(method, path, body) {
    const headers = {};
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
    
    let fetchBody = undefined;
    if (body) {
      if (body instanceof FormData) {
        fetchBody = body;
      } else {
        headers["Content-Type"] = "application/json";
        fetchBody = JSON.stringify(body);
      }
    }

    let res;
    try {
      res = await fetch(cfg.API_BASE_URL + path, {
        method,
        headers,
        body: fetchBody,
      });
    } catch (e) {
      throw new ApiError("No se pudo conectar con el servidor.", 0);
    }
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw new ApiError((data && data.message) || "Error " + res.status, res.status);
    return data;
  }

  /* =========================================================
     MOCK transport — resolves against App.mock / local db
     ========================================================= */
  async function mockRequest(method, path, body) {
    await wait(cfg.MOCK_LATENCY);
    loadDb();
    const seg = path.split("?")[0].split("/").filter(Boolean); // e.g. ["expenses","u1-e3"]
    const token = getToken();
    const session = token ? decodeJwt(token) : null;

    /* ---- AUTH ---- */
    if (path === "/auth/login" && method === "POST") {
      const u = App.mock.users.find((x) => x.email.toLowerCase() === (body.email || "").toLowerCase());
      if (!u || u.password !== body.password) throw new ApiError("Email o contraseña incorrectos.", 401);
      return { token: fakeJwt({ sub: u.id, role: u.role, name: u.name, email: u.email, iat: Date.now() }), user: safeUser(u) };
    }
    if (path === "/auth/register" && method === "POST") {
      if (App.mock.users.some((x) => x.email.toLowerCase() === (body.email || "").toLowerCase()))
        throw new ApiError("Ya existe una cuenta con ese email.", 409);
      const u = { id: uid(), name: body.name, email: body.email, password: body.password,
        role: "user", joined: new Date().toISOString().slice(0, 10), phone: "", city: "" };
      App.mock.users.push(u);
      return { token: fakeJwt({ sub: u.id, role: u.role, name: u.name, email: u.email, iat: Date.now() }), user: safeUser(u) };
    }

    /* everything below requires a session */
    if (!session) throw new ApiError("Sesión expirada. Iniciá sesión nuevamente.", 401);

    /* ---- EXPENSES ---- */
    if (seg[0] === "expenses") {
      if (method === "GET") {
        // advisor may pass ?userId=, regular users always see their own
        const params = new URLSearchParams(path.split("?")[1] || "");
        const target = session.role === "advisor" && params.get("userId") ? params.get("userId") : session.sub;
        return db.expenses.filter((e) => e.userId === target).sort((a, b) => b.date.localeCompare(a.date));
      }
      if (method === "POST") {
        const e = { id: uid(), userId: session.sub, ...sanitizeExpense(body) };
        db.expenses.unshift(e); saveDb(); return e;
      }
      if (method === "PUT") {
        const e = db.expenses.find((x) => x.id === seg[1]);
        if (!e) throw new ApiError("No se encontró el gasto.", 404);
        Object.assign(e, sanitizeExpense(body)); saveDb(); return e;
      }
      if (method === "DELETE") {
        const i = db.expenses.findIndex((x) => x.id === seg[1]);
        if (i === -1) throw new ApiError("No se encontró el gasto.", 404);
        db.expenses.splice(i, 1); saveDb(); return null;
      }
    }

    /* ---- TICKET OCR ---- */
    if (path === "/tickets/upload" && method === "POST") {
      return mockOcr();
    }

    /* ---- ADVISOR: users ---- */
    if (path === "/users" && method === "GET") {
      if (session.role !== "advisor") throw new ApiError("No autorizado.", 403);
      return App.mock.users.filter((u) => u.role === "user").map(safeUser);
    }

    /* ---- ADVISOR: recommendations ---- */
    if (seg[0] === "recommendations") {
      if (session.role !== "advisor" && method === "POST") throw new ApiError("No autorizado.", 403);
      if (method === "GET") {
        const params = new URLSearchParams(path.split("?")[1] || "");
        const target = params.get("userId");
        return db.recommendations.filter((r) => r.userId === target).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
      if (method === "POST") {
        const rec = { id: uid(), userId: body.userId, title: body.title, text: body.text,
          author: session.name, createdAt: new Date().toISOString() };
        db.recommendations.unshift(rec); saveDb(); return rec;
      }
    }

    /* ---- CONSULTATIONS ---- */
    if (seg[0] === 'consultations') {
      if (!db.consultations) { db.consultations = []; saveDb(); }

      if (method === 'POST' && seg.length === 1) {
        if (session.role !== 'user') throw new ApiError('No autorizado.', 403);
        const c = { id: uid(), userId: session.sub, question: body.question,
          answer: null, answeredAt: null, createdAt: new Date().toISOString() };
        db.consultations.unshift(c); saveDb(); return c;
      }
      if (method === 'GET' && seg[1] === 'mine') {
        if (session.role !== 'user') throw new ApiError('No autorizado.', 403);
        return db.consultations.filter((c) => c.userId === session.sub);
      }
      if (method === 'GET' && seg.length === 1) {
        if (session.role !== 'advisor') throw new ApiError('No autorizado.', 403);
        return db.consultations.map((c) => {
          const u = App.mock.users.find((x) => x.id === c.userId);
          return { ...c, user: u ? { id: u.id, name: u.name, email: u.email } : null };
        });
      }
      if (method === 'PATCH' && seg[2] === 'answer') {
        if (session.role !== 'advisor') throw new ApiError('No autorizado.', 403);
        const c = db.consultations.find((x) => x.id === seg[1]);
        if (!c) throw new ApiError('Consulta no encontrada.', 404);
        Object.assign(c, { answer: body.answer, answeredAt: new Date().toISOString() });
        saveDb(); return c;
      }
    }

    /* ---- PROFILE ---- */
    if (path === "/me" && method === "PUT") {
      const u = App.mock.users.find((x) => x.id === session.sub);
      if (u) Object.assign(u, { name: body.name, phone: body.phone, city: body.city });
      return safeUser(u);
    }

    throw new ApiError("Endpoint no implementado: " + method + " " + path, 404);
  }

  function safeUser(u) { const { password, ...rest } = u; return rest; }
  function sanitizeExpense(b) {
    return {
      merchant: (b.merchant || "").trim(),
      category: b.category,
      amount: Math.round(Number(b.amount) || 0),
      date: b.date,
      description: (b.description || "").trim(),
    };
  }
  /* Simulated OCR result for a ticket image. */
  function mockOcr() {
    const samples = [
      { merchant: "Coto", amount: 18470, category: "comida", date: todayISO(-2) },
      { merchant: "YPF", amount: 24500, category: "transporte", date: todayISO(-1) },
      { merchant: "Farmacity", amount: 9320, category: "salud", date: todayISO(0) },
      { merchant: "Mercado Libre", amount: 56990, category: "compras", date: todayISO(-4) },
    ];
    const s = samples[Math.floor(Math.random() * samples.length)];
    return { ...s, confidence: 0.9 + Math.random() * 0.09, description: "Importado desde ticket" };
  }
  function todayISO(offset) { const d = new Date(2026, 4, 28); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); }

  /* -------- unified entry point -------- */
  function request(method, path, body) {
    return cfg.USE_MOCK ? mockRequest(method, path, body) : realRequest(method, path, body);
  }

  /* =========================================================
     Public, intention-revealing methods
     ========================================================= */
  return {
    getToken, decodeJwt,
    // auth
    login: (email, password) => request("POST", "/auth/login", { email, password }),
    register: (payload) => request("POST", "/auth/register", payload),
    // expenses
    getExpenses: (userId) => request("GET", "/expenses" + (userId ? "?userId=" + userId : "")),
    createExpense: (payload) => request("POST", "/expenses", payload),
    updateExpense: (id, payload) => request("PUT", "/expenses/" + id, payload),
    deleteExpense: (id) => request("DELETE", "/expenses/" + id),
    uploadTicket: (file) => {
      if (cfg.USE_MOCK) {
        return request("POST", "/tickets/upload", { filename: file && file.name });
      } else {
        const formData = new FormData();
        formData.append("file", file);
        return request("POST", "/tickets/upload", formData);
      }
    },
    // advisor
    listUsers: () => request("GET", "/users"),
    getRecommendations: (userId) => request("GET", "/recommendations?userId=" + userId),
    addRecommendation: (payload) => request("POST", "/recommendations", payload),
    // consultations
    getMyConsultations: () => request('GET', '/consultations/mine'),
    createConsultation: (question) => request('POST', '/consultations', { question }),
    getAllConsultations: () => request('GET', '/consultations'),
    answerConsultation: (id, answer) => request('PATCH', '/consultations/' + id + '/answer', { answer }),
    // profile
    updateProfile: (payload) => request("PUT", "/me", payload),
  };
})();
