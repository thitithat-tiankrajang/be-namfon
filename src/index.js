// src/index.js
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { upload, deleteImage } from './cloudinary.js';

const app  = express();
const db   = new PrismaClient();

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function ok(res, data)  { res.json(data); }
function err(res, msg, code = 500) { res.status(code).json({ error: msg }); }

// ─────────────────────────────────────────────
// PORTRAITS  (photo1 / photo2)
// ─────────────────────────────────────────────

// GET all portrait URLs → { photo1: "https://...", photo2: "https://..." }
app.get('/api/photos', async (_req, res) => {
  try {
    const rows  = await db.photo.findMany();
    const out   = {};
    rows.forEach(r => { out[r.key] = r.url; });
    ok(res, out);
  } catch (e) { err(res, e.message); }
});

// POST upload / replace portrait
// field name: "file"  |  param: "photo1" | "photo2"
app.post('/api/photos/:key', upload.single('file'), async (req, res) => {
  try {
    const { key } = req.params;
    if (!['photo1', 'photo2'].includes(key)) return err(res, 'Invalid key', 400);
    if (!req.file) return err(res, 'No file uploaded', 400);

    // If replacing, delete the old Cloudinary asset
    const existing = await db.photo.findUnique({ where: { key } });
    if (existing?.pubId) await deleteImage(existing.pubId);

    const photo = await db.photo.upsert({
      where:  { key },
      create: { key, url: req.file.path, pubId: req.file.filename },
      update: { url: req.file.path, pubId: req.file.filename },
    });

    ok(res, { url: photo.url });
  } catch (e) { err(res, e.message); }
});

// ─────────────────────────────────────────────
// CALENDAR EVENTS
// ─────────────────────────────────────────────

// GET all events → { "YYYY-MM-DD": { type, name, note }, … }
app.get('/api/calendar', async (_req, res) => {
  try {
    const rows = await db.calEvent.findMany();
    const out  = {};
    rows.forEach(r => {
      out[r.dateKey] = { type: r.type, name: r.name, note: r.note };
    });
    ok(res, out);
  } catch (e) { err(res, e.message); }
});

// PUT upsert one event
app.put('/api/calendar/:dateKey', async (req, res) => {
  try {
    const { dateKey } = req.params;
    if (!DATE_RE.test(dateKey)) return err(res, 'Invalid date key (expected YYYY-MM-DD)', 400);

    const { type, name = '', note = '' } = req.body;
    if (!type) return err(res, 'type is required', 400);

    const event = await db.calEvent.upsert({
      where:  { dateKey },
      create: { dateKey, type, name, note },
      update: { type, name, note },
    });

    ok(res, { ok: true, event: { type: event.type, name: event.name, note: event.note } });
  } catch (e) { err(res, e.message); }
});

// DELETE one event
app.delete('/api/calendar/:dateKey', async (req, res) => {
  try {
    const { dateKey } = req.params;
    await db.calEvent.deleteMany({ where: { dateKey } });
    ok(res, { ok: true });
  } catch (e) { err(res, e.message); }
});

// ─────────────────────────────────────────────
// MEMORIES
// ─────────────────────────────────────────────

// GET all memories (newest first)
app.get('/api/memories', async (_req, res) => {
  try {
    const rows = await db.memory.findMany({ orderBy: { createdAt: 'desc' } });
    // Map DB fields → frontend expects { id, title, date, story, imgPath }
    ok(res, rows.map(m => ({
      id:      m.id,
      title:   m.title,
      date:    m.date,
      story:   m.story,
      imgPath: m.imgUrl ?? null,
    })));
  } catch (e) { err(res, e.message); }
});

// POST create memory  (multipart: title, date, story, img?)
app.post('/api/memories', upload.single('img'), async (req, res) => {
  try {
    const { title, date = '', story = '' } = req.body;
    if (!title) return err(res, 'title is required', 400);

    const imgUrl   = req.file ? req.file.path     : null;
    const imgPubId = req.file ? req.file.filename  : null;

    const mem = await db.memory.create({
      data: { title, date, story, imgUrl, imgPubId },
    });

    ok(res, {
      id:      mem.id,
      title:   mem.title,
      date:    mem.date,
      story:   mem.story,
      imgPath: mem.imgUrl ?? null,
    });
  } catch (e) { err(res, e.message); }
});

// DELETE memory + its Cloudinary image
app.delete('/api/memories/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return err(res, 'Invalid id', 400);

    const mem = await db.memory.findUnique({ where: { id } });
    if (!mem) return err(res, 'Not found', 404);

    await deleteImage(mem.imgPubId);
    await db.memory.delete({ where: { id } });
    ok(res, { ok: true });
  } catch (e) { err(res, e.message); }
});

// ─────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    const [calCount, memCount, photoCount] = await Promise.all([
      db.calEvent.count(),
      db.memory.count(),
      db.photo.count(),
    ]);
    ok(res, { ok: true, calCount, memCount, photoCount });
  } catch (e) { err(res, e.message); }
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function main() {
  await db.$connect();
  app.listen(PORT, () => {
    console.log(`✅  Rain & Best backend v2 — http://localhost:${PORT}`);
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
