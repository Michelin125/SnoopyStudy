require("dotenv").config();
require("express-async-errors");
const express = require("express"),
  cors = require("cors"),
  mongoose = require("mongoose"),
  jwt = require("jsonwebtoken"),
  crypto = require("crypto");
const app = express();
app.use(cors({ origin: process.env.FRONT_URL || "*" }));
app.use(express.json({ limit: "100kb" }));

const opts = {
  toJSON: {
    versionKey: false,
    transform: (_, o) => {
      o.id = o._id;
      delete o._id;
    },
  },
};
const stamp = {
  ...opts,
  timestamps: { createdAt: "created_at", updatedAt: false },
};
const Item = mongoose.model(
  "Item",
  new mongoose.Schema(
    {
      name: { type: String, required: true },
      description: String,
      price_xp: { type: Number, default: 0 },
      emoji: { type: String, default: "feliz.png" },
    },
    opts,
  ),
);
const Msg = mongoose.model(
  "Message",
  new mongoose.Schema({ name: String, email: String, text: String }, stamp),
);
const User = mongoose.model(
  "User",
  new mongoose.Schema(
    {
      name: String,
      email: { type: String, unique: true, required: true },
      salt: String,
      hash: String,
      xp: { type: Number, default: 0 },
      goals: { type: [mongoose.Schema.Types.Mixed], default: [] },
      owned: { type: [String], default: [] },
    },
    stamp,
  ),
);
const seed = [
  ["Emblema Estudioso", "Muestra tu constancia.", 50, "estudiando.png"],
  ["Collar Morado", "Estilo para Snoopy.", 80, "conforme.png"],
  ["Avatar Piloto", "Snoopy as del aire.", 120, "idea.png"],
  ["Corona Experto", "Para nivel 5 o más.", 200, "nivel experto.png"],
].map(([name, description, price_xp, emoji]) => ({
  name,
  description,
  price_xp,
  emoji,
}));

// ----- Autenticación: JWT con rol (admin o estudiante) -----
const sign = (p) =>
  jwt.sign(p, process.env.JWT_SECRET, {
    expiresIn: p.role === "admin" ? "8h" : "7d",
  });
const need = (role) => (req, res, next) => {
  try {
    const p = jwt.verify(
      (req.headers.authorization || "").slice(7),
      process.env.JWT_SECRET,
    );
    if (p.role !== role) throw 0;
    req.user = p;
    next();
  } catch {
    res.status(401).json({ error: "No autorizado" });
  }
};
const admin = need("admin"),
  student = need("user");
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString("hex");

app.get("/", (_, res) => res.json({ ok: true }));

// ----- Catálogo (tienda) -----
app.get("/api/catalog", async (_, res) =>
  res.json(await Item.find().sort("_id")),
);
app.post("/api/catalog", admin, async (req, res) => {
  const { name, description, price_xp, emoji } = req.body;
  res
    .status(201)
    .json(await Item.create({ name, description, price_xp, emoji }));
});
app.delete("/api/catalog/:id", admin, async (req, res) => {
  await Item.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ----- Contacto -----
app.post("/api/messages", async (req, res) => {
  const { name, email, text } = req.body;
  if (!name || !email || !text)
    return res.status(400).json({ error: "Faltan datos" });
  res.status(201).json(await Msg.create({ name, email, text }));
});
app.get("/api/messages", admin, async (_, res) =>
  res.json(await Msg.find().sort("-created_at")),
);

// ----- Administrador -----
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  )
    return res.json({ token: sign({ role: "admin", email }) });
  res.status(401).json({ error: "Credenciales inválidas" });
});
app.get("/api/users", admin, async (_, res) =>
  res.json(
    await User.find().select("name email xp created_at").sort("-created_at"),
  ),
);

// ----- Estudiantes: registro, inicio de sesión y progreso guardado -----
app.post("/api/register", async (req, res) => {
  const name = String(req.body.name || "")
      .trim()
      .slice(0, 60),
    email = String(req.body.email || "")
      .trim()
      .toLowerCase(),
    pw = String(req.body.password || "");
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || pw.length < 6)
    return res.status(400).json({
      error: "Revisa nombre, correo y contraseña (mínimo 6 caracteres)",
    });
  const salt = crypto.randomBytes(16).toString("hex");
  let u;
  try {
    u = await User.create({ name, email, salt, hash: hashPw(pw, salt) });
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ error: "Ese correo ya tiene cuenta" });
    throw e;
  }
  res.status(201).json({ token: sign({ role: "user", id: u.id }), name });
});
app.post("/api/signin", async (req, res) => {
  const u = await User.findOne({
    email: String(req.body.email || "")
      .trim()
      .toLowerCase(),
  });
  const ok =
    u &&
    crypto.timingSafeEqual(
      Buffer.from(hashPw(String(req.body.password || ""), u.salt), "hex"),
      Buffer.from(u.hash, "hex"),
    );
  if (!ok)
    return res.status(401).json({ error: "Correo o contraseña incorrectos" });
  res.json({ token: sign({ role: "user", id: u.id }), name: u.name });
});
app.get("/api/me", student, async (req, res) => {
  const u = await User.findById(req.user.id);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  res.json({ name: u.name, xp: u.xp, goals: u.goals, owned: u.owned });
});
app.put("/api/me", student, async (req, res) => {
  const b = req.body,
    s = (v, n) => String(v ?? "").slice(0, n);
  const goals = (Array.isArray(b.goals) ? b.goals : [])
    .slice(0, 100)
    .map((g) => ({
      id: +g.id || Date.now(),
      materia: s(g.materia, 60),
      tema: s(g.tema, 80),
      min: Math.min(480, Math.max(0, +g.min || 0)),
      nivel: s(g.nivel, 20),
      done: !!g.done,
    }));
  const xp = Math.min(1e6, Math.max(0, Math.floor(+b.xp || 0)));
  const owned = (Array.isArray(b.owned) ? b.owned : [])
    .slice(0, 100)
    .map((x) => s(x, 40));
  await User.updateOne({ _id: req.user.id }, { xp, goals, owned });
  res.json({ ok: true });
});

app.use((e, _req, res, _next) => {
  console.error(e);
  res.status(500).json({ error: "Error del servidor" });
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    if (!(await Item.countDocuments())) await Item.insertMany(seed);
    app.listen(process.env.PORT || 3000, () =>
      console.log("API lista y conectada a MongoDB"),
    );
  })
  .catch((e) => {
    console.error("Error al conectar con MongoDB:", e.message);
    process.exit(1);
  });
