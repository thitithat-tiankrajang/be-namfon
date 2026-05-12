# Rain & Best — Backend v2

> ข้อมูลถาวร 100% — PostgreSQL (Neon) + Cloudinary

---

## Stack

| Service | ทำหน้าที่ | Free tier |
|---|---|---|
| **Neon PostgreSQL** | เก็บ events, memories, photo URLs | 0.5 GB, ไม่หาย |
| **Cloudinary** | เก็บรูปภาพ CDN | 25 GB bandwidth/เดือน |
| **Render.com** | รัน Express server | free (sleeps after 15min inactivity) |

---

## วิธี Deploy ทีละขั้น

### 1. สร้าง Neon Database (ฟรี)

1. ไปที่ [neon.tech](https://neon.tech) → Sign up / Login
2. **New Project** → ตั้งชื่อ "rain-best"
3. หลัง create เสร็จ → คลิก **Connection string**
4. เลือก format **"Prisma"** → copy URL
   ```
   postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

### 2. สร้าง Cloudinary Account (ฟรี)

1. ไปที่ [cloudinary.com](https://cloudinary.com) → Sign up
2. Dashboard → **API Keys** → copy:
   - Cloud name
   - API Key
   - API Secret

### 3. ตั้งค่า Environment บน Render

ใน Render dashboard → Service → **Environment** → เพิ่ม:

```
DATABASE_URL        = postgresql://...  (จาก Neon)
CLOUDINARY_CLOUD_NAME = your_cloud_name
CLOUDINARY_API_KEY    = your_api_key
CLOUDINARY_API_SECRET = your_api_secret
```

### 4. Deploy ครั้งแรก (migrate DB)

ใน Render → Service Settings → **Build Command**:
```
npm install && npx prisma generate && npx prisma db push
```

**Start Command**:
```
node src/index.js
```

> `prisma db push` จะสร้าง tables ใน Neon ให้อัตโนมัติ ไม่ต้องเขียน SQL เอง

---

## Run ใน Local

```bash
# clone / copy folder นี้
cp .env.example .env
# แก้ไข .env ใส่ค่าจริง

npm install
npx prisma generate
npx prisma db push     # สร้าง tables ครั้งแรก
npm run dev            # รัน + auto-restart เมื่อแก้ไข
```

---

## API Reference

### Photos
| Method | Path | Body / Field | Returns |
|---|---|---|---|
| GET | `/api/photos` | — | `{ photo1?: url, photo2?: url }` |
| POST | `/api/photos/photo1` | form-data `file` | `{ url }` |
| POST | `/api/photos/photo2` | form-data `file` | `{ url }` |

### Calendar
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/calendar` | — | `{ "YYYY-MM-DD": { type, name, note } }` |
| PUT | `/api/calendar/:dateKey` | `{ type, name?, note? }` | `{ ok, event }` |
| DELETE | `/api/calendar/:dateKey` | — | `{ ok }` |

### Memories
| Method | Path | Body / Field | Returns |
|---|---|---|---|
| GET | `/api/memories` | — | `[ { id, title, date, story, imgPath } ]` |
| POST | `/api/memories` | form-data `title, date?, story?, img?` | memory object |
| DELETE | `/api/memories/:id` | — | `{ ok }` |

### Health
| Method | Path | Returns |
|---|---|---|
| GET | `/api/health` | `{ ok, calCount, memCount, photoCount }` |

---

## โครงสร้าง DB

```
cal_events
  date_key  TEXT PK   -- "2025-06-15"
  type      TEXT      -- "busy"|"free"|"date"|"special"
  name      TEXT
  note      TEXT

memories
  id         SERIAL PK
  title      TEXT
  date       TEXT      -- "YYYY-MM-DD"
  story      TEXT
  img_url    TEXT?     -- Cloudinary URL
  img_pub_id TEXT?     -- สำหรับลบรูปออก Cloudinary
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

photos
  key        TEXT PK   -- "photo1" | "photo2"
  url        TEXT      -- Cloudinary URL
  pub_id     TEXT      -- สำหรับลบรูปเก่า
  updated_at TIMESTAMPTZ
```

---

## ทำไมถึงไม่หายอีกแล้ว

| เดิม (lowdb) | ใหม่ |
|---|---|
| JSON file บน Render disk | PostgreSQL บน Neon (cloud แยก) |
| หายทุกครั้ง Render restart | คงอยู่ตลอด ไม่ขึ้นกับ server |
| รูปภาพบน local `/uploads` | Cloudinary CDN — ลบรูปเก่าอัตโนมัติเมื่อ replace |
| ไม่มี type safety | Prisma ORM — query type-safe, migration automatic |
