import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { v4 as uuidv4 } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- DB SETUP ----
const dbPath = join(__dirname, 'data', 'db.json');
mkdirSync(join(__dirname, 'data'), { recursive: true });
mkdirSync(join(__dirname, 'uploads'), { recursive: true });

const adapter = new JSONFile(dbPath);
const db = new Low(adapter, {
  calEvents: {},     // { "YYYY-MM-DD": { type, name, note } }
  memories: [],      // [ { id, title, date, story, imgPath } ]
  photos: {},        // { photo1: "/uploads/xxx.jpg", photo2: "..." }
  meta: {}
});

await db.read();

// ---- MULTER ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname) || '.jpg';
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// ---- EXPRESS ----
const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// ---- HELPERS ----
async function save() {
  await db.write();
}

// ---- ROUTES ----

// === PORTRAITS ===
// GET portrait paths
app.get('/api/photos', (req, res) => {
  res.json(db.data.photos);
});

// POST upload portrait (key = "photo1" or "photo2")
app.post('/api/photos/:key', upload.single('file'), async (req, res) => {
  try {
    const { key } = req.params;
    if (!['photo1', 'photo2'].includes(key)) return res.status(400).json({ error: 'Invalid key' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    db.data.photos[key] = `/uploads/${req.file.filename}`;
    await save();
    res.json({ url: db.data.photos[key] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === CALENDAR EVENTS ===
// GET all events
app.get('/api/calendar', (req, res) => {
  res.json(db.data.calEvents);
});

// PUT upsert one event by date key
app.put('/api/calendar/:dateKey', async (req, res) => {
  try {
    const { dateKey } = req.params;
    // validate format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return res.status(400).json({ error: 'Invalid date key' });
    const { type, name, note } = req.body;
    if (!type) return res.status(400).json({ error: 'type is required' });

    db.data.calEvents[dateKey] = { type, name: name || '', note: note || '' };
    await save();
    res.json({ ok: true, event: db.data.calEvents[dateKey] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE one event
app.delete('/api/calendar/:dateKey', async (req, res) => {
  try {
    const { dateKey } = req.params;
    delete db.data.calEvents[dateKey];
    await save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === MEMORIES ===
// GET all memories
app.get('/api/memories', (req, res) => {
  // return newest first
  const sorted = [...db.data.memories].sort((a, b) => b.id - a.id);
  res.json(sorted);
});

// POST create memory (with optional image)
app.post('/api/memories', upload.single('img'), async (req, res) => {
  try {
    const { title, date, story } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const mem = {
      id: Date.now(),
      title,
      date: date || '',
      story: story || '',
      imgPath: req.file ? `/uploads/${req.file.filename}` : null
    };

    db.data.memories.push(mem);
    await save();
    res.json(mem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE memory
app.delete('/api/memories/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.data.memories = db.data.memories.filter(m => m.id !== id);
    await save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === HEALTH ===
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    calEventCount: Object.keys(db.data.calEvents).length,
    memoryCount: db.data.memories.length
  });
});

// ---- START ----
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Rain & Best backend running on http://localhost:${PORT}`);
});