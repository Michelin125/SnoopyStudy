# SnoopyStudy
Convierte tus metas académicas en logros. Aplicación web full stack con gamificación (XP, niveles, tienda de recompensas) y un tutor de estudio con IA.

## Cumplimiento del proyecto
| Requisito | Dónde está |
|---|---|
| Landing / inicio | `index.html`: marca, mensaje, secciones y navegación |
| Catálogo | Tienda de recompensas, leída de MongoDB (`/api/catalog`) |
| Contacto real | Formulario que guarda en MongoDB (`/api/messages`) |
| Panel admin | Login con JWT; ve mensajes y estudiantes y gestiona el catálogo |
| IA aplicada | Snoopy AI: planes de estudio, tarjetas de estudio a partir de apuntes y técnicas de estudio |
| Publicación | Frontend en GitHub Pages, backend en Render |
| Responsive | CSS con grid, flex y media queries |

## Arquitectura
Usuario → Frontend (HTML, CSS, JS) → Backend (Node + Express, JWT) → Base de datos (MongoDB Atlas).
Los estudiantes se registran, su contraseña se guarda con hash (scrypt) y su progreso (XP, metas, compras) se guarda en su cuenta.

## Ejecutar en local
1. `npm install`
2. Copia `.env.example` a `.env` y llena tus datos (nunca subas el `.env`).
3. `npm run dev` (debe decir "API lista y conectada a MongoDB").
4. En `script.js` pon `const API_URL = "http://localhost:3000";` y abre `index.html` con Live Server.

## Publicar
- **Backend (Render):** New → Web Service → este repositorio. Build: `npm install`. Start: `npm start`. Variables: `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FRONT_URL` (la dirección de tu GitHub Pages, sin ruta, ej. `https://usuario.github.io`).
- **Frontend (GitHub Pages):** Settings → Pages → rama `main`, carpeta raíz. Antes, en `script.js`, pon en `API_URL` la dirección que te dio Render.
