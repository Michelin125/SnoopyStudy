// Extras de SnoopyStudy: cuentas de estudiante, progreso guardado en MongoDB y radar de aprendizaje.
// Se carga después de script.js y reutiliza sus funciones (st, renderGoals, renderCatalog, call, esc...).
const utok = () => localStorage.getItem("utoken");
async function ucall(path, method = "GET", body, token = utok()) {
  const r = await fetch(API_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Error " + r.status);
  return d;
}
const push = () =>
  ucall("/api/me", "PUT", {
    xp: st.xp,
    goals: st.goals,
    owned: st.owned,
  }).catch(() => {});
async function pull() {
  try {
    const d = await ucall("/api/me");
    if (d.goals.length || d.xp)
      st = { xp: d.xp, goals: d.goals, owned: d.owned };
    else await push();
    renderGoals();
    renderCatalog();
  } catch {
    localStorage.removeItem("utoken");
    showAccount();
  }
}
function showAccount() {
  const on = !!utok();
  $("#authForm").hidden = on;
  $("#whoami").hidden = !on;
  $("#who").textContent = on
    ? `Hola, ${localStorage.getItem("uname") || "estudiante"}. Tu progreso se guarda en tu cuenta.`
    : "";
}
function radar() {
  const el = $("#radar");
  if (!el) return;
  const by = {};
  st.goals.forEach((g) => {
    const k = g.materia.trim().toLowerCase();
    (by[k] ||= { n: g.materia, t: 0, d: 0 }).t++;
    if (g.done) by[k].d++;
  });
  const m = Object.values(by).slice(0, 6);
  if (m.length < 3) {
    el.innerHTML =
      "<small>Crea metas en 3 materias distintas para ver tu radar.</small>";
    return;
  }
  const R = 80,
    pt = (i, r) =>
      [
        110 + r * Math.sin((2 * Math.PI * i) / m.length),
        110 - r * Math.cos((2 * Math.PI * i) / m.length),
      ].map((v) => v.toFixed(1));
  const ring = (f) => m.map((_, i) => pt(i, R * f).join(",")).join(" ");
  el.innerHTML = `<svg viewBox="0 0 220 220" role="img" aria-label="Radar de aprendizaje"><polygon points="${ring(1)}" class="rg"/><polygon points="${ring(0.5)}" class="rg"/><polygon points="${m.map((x, i) => pt(i, R * Math.max(0.08, x.d / x.t)).join(",")).join(" ")}" class="rd"/>${m
    .map((x, i) => {
      const [a, b] = pt(i, R + 14);
      return `<text x="${a}" y="${b}" text-anchor="middle" font-size="9">${esc(x.n.slice(0, 10))}</text>`;
    })
    .join("")}</svg>`;
}

// Se envuelven las funciones de script.js para agregar radar, sincronización y lista de estudiantes en el admin
let syncTimer;
const _renderGoals = renderGoals;
renderGoals = function () {
  _renderGoals();
  radar();
  if (API_URL && utok()) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(push, 600);
  }
};
const _renderAdmin = renderAdmin;
renderAdmin = async function () {
  await _renderAdmin();
  const grid = $("#panel .grid2");
  if (!API_URL || $("#panel").hidden || !grid) return;
  if (!$("#users"))
    grid.insertAdjacentHTML(
      "beforeend",
      '<div class="card"><h3>Estudiantes registrados</h3><ul id="users"></ul></div>',
    );
  try {
    const us = await call("/api/users");
    $("#users").innerHTML = us.length
      ? us
          .map(
            (u) =>
              `<li><span><b>${esc(u.name)}</b> (${esc(u.email)})</span><span>⭐ ${u.xp} XP</span></li>`,
          )
          .join("")
      : "<li>Aún no hay estudiantes.</li>";
  } catch {
    $("#users").innerHTML = "<li>No se pudo cargar la lista.</li>";
  }
};

document.addEventListener("DOMContentLoaded", () => {
  $("#goals").parentElement.insertAdjacentHTML(
    "beforeend",
    '<h4>Radar de aprendizaje</h4><div id="radar" class="radar"></div>',
  );
  $("#cuenta").hidden = !API_URL;
  const enter = async (path, body) => {
    try {
      const d = await ucall(path, "POST", body, null);
      localStorage.setItem("utoken", d.token);
      localStorage.setItem("uname", d.name);
      $("#aStatus").textContent = "";
      showAccount();
      await pull();
    } catch (e) {
      $("#aStatus").textContent = e.message;
    }
  };
  $("#authForm").onsubmit = (e) => {
    e.preventDefault();
    enter("/api/signin", Object.fromEntries(new FormData(e.target)));
  };
  $("#signup").onclick = () => {
    const f = Object.fromEntries(new FormData($("#authForm")));
    if (!f.name || !f.email || f.password.length < 6) {
      $("#aStatus").textContent =
        "Para crear cuenta escribe nombre, correo y contraseña (mínimo 6).";
      return;
    }
    enter("/api/register", f);
  };
  $("#signout").onclick = () => {
    localStorage.removeItem("utoken");
    localStorage.removeItem("uname");
    st = { xp: 0, goals: [], owned: [] };
    renderGoals();
    renderCatalog();
    showAccount();
  };
  showAccount();
  renderGoals();
  if (API_URL && utok()) pull();
});
