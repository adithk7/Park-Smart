# ParkSmart 🚘⚡

> **Smart Parking & Venue Operations Platform**  
> A Next.js + Prisma PWA for real-time multi-tenant parking management, ANPR vision integrations, and automated visitor processing.

---

## 🌟 Architecture Overview & Tech Stack

- **Web Frontend & API**: Next.js (App Router), TypeScript, Tailwind CSS, Lucide Icons
- **Database & ORM**: Prisma ORM with SQLite for local development (100% PostgreSQL schema-compatible for production)
- **Realtime Stream**: Server-Sent Events (SSE) for live gate status, occupancy tallies, and ANPR updates
- **Edge Vision Engine**: Python FastAPI service (`/edge/main.py`) for webcam ANPR license plate recognition
- **Design System**: High-contrast dark theme, glassmorphism card primitives, micro-animations, and dynamic status badges

---

## 🔒 Domain Rules & Multi-Tenancy Engine

1. **Multi-Tenant Scoping (`ParkingArea`)**:
   - Every database model contains `parkingAreaId` indexed for tenant isolation.
   - All API endpoints and database queries are strictly scoped to the active tenant.
2. **Role Hierarchy**:
   - **`ADMIN`**: Multi-gate management, occupancy rate overrides, tariffs, and revenue metrics.
   - **`STAFF`**: Attendant tally counter, manual entry/exit validation, barrier controls, and dispute logs.
   - **`DRIVER`**: Zero-login experience via QR code or SMS session link (`/driver/[sessionCode]`).
3. **Visit Session Lifecycle**:
   - A single `VisitSession` tracks a vehicle from entry detection to payment and exit barrier release.
   - All audit logs, payments, and gate events attach directly to the `VisitSession`.
4. **Plate Hashing & Privacy Rule (HMAC SHA-256)**:
   - **Raw plates are NEVER stored in analytics tables.**
   - Analytics tables store `plateToken = HMAC-SHA256(plate, SECRET)`.
   - Raw plates exist ONLY on active `VisitSession` records for exit display & dispute resolution.
5. **Dual Visit Models**:
   - **`TRANSIENT`**: On-demand hourly visitors, UPI QR dynamic pricing.
   - **`RECURRING`**: Standing profiles for residents & employees with fixed slot reservations.
6. **Site Tiers (0 - 3)**:
   - **Tier 0**: Fully manual attendant tallies
   - **Tier 1**: Digital gate counter
   - **Tier 2**: Basic camera ANPR
   - **Tier 3**: Fully automated vision + FASTag + barrier gates

---

## 📁 Repository Directory Structure

```
Park-Smart/
├── app/                  # Next.js App Router (pages, layout, globals.css, API routes)
├── components/           # Reusable UI component design system (button, card, badge, input, modal)
├── lib/                  # Core helpers (db.ts singleton, utils.ts, security.ts HMAC hasher)
├── prisma/               # Prisma schema & seed script
│   ├── schema.prisma     # Postgres-compatible multi-tenant schema
│   └── seed.ts           # Demo tenant seed data script
├── edge/                 # Python FastAPI ANPR & Computer Vision Service
│   ├── main.py           # OpenCV / EasyOCR ANPR webcam service
│   └── requirements.txt
├── scripts/              # Traffic simulation script
│   └── simulate_traffic.ts
├── .env.example          # Environment variable template
└── README.md             # Project documentation
```

---

## 🚀 Quickstart & Setup Instructions

### 1. Prerequisites
- Node.js 18+ and npm
- Python 3.10+ (for edge ANPR vision service)

### 2. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Database Initialization & Seeding
Push the Prisma schema to SQLite and run the demo seed script:
```bash
npm run db:push
npm run db:seed
```

### 4. Run Next.js Web Application
Start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Edge ANPR Vision Service (Optional / Phase 2)
In a separate terminal, start the Python FastAPI service:
```bash
cd edge
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
API docs will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 🛠️ Demo Integrations

| Feature | Implementation | Description |
| :--- | :--- | :--- |
| **UPI Payments** | Simulated | Instant QR code generation with fake payment webhook triggers |
| **FASTag Debit** | Simulated | Auto-debit simulation upon ANPR match at exit gate |
| **Physical Barrier** | Simulated | Visual pulse indicator and state toggle for entry/exit gates |
| **Webcam ANPR** | **REAL** | Python OpenCV/EasyOCR vision pipeline reading live webcam feeds |
| **Masked Phone Calls** | **REAL** | Exotel API integration for proxy calls between driver & staff |

---

## 🎨 UI Design System Primitives

The codebase includes standard, beautiful design primitives in `components/ui/`:
- `<Button variant="glow | primary | secondary | outline | danger | success" size="sm | md | lg" />`
- `<Card variant="glass | solid | outline | gradient" />`
- `<Badge variant="success | warning | danger | info | accent | purple" pulse={true} />`
- `<Input label="..." error="..." />` & `<Select label="..." />`
- `<Modal isOpen={true} onClose={...} title="...">`
