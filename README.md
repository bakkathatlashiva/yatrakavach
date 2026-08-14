# YatraKavach — Provider Network, Admin Controls & Emergency Assistance

New in this build: SUPER_ADMIN provider network (mechanics/fuel/towing/EV/other), auto
provider matching (distance/ETA/availability/reliability/rating scoring), full emergency
request lifecycle with Socket.IO live tracking, provider dashboard, admin live monitor,
and the Bhadrachalam Highway demo (Shiva's Garage + Shiva's Bunk).

## Run

Backend (port 4000):
    cd backend
    npm install
    npm start

Frontend (port 5173):
    cd frontend
    npm install
    npm run dev

Open http://localhost:5173 — pick a demo account on the login screen.

## Demo accounts
- Admin — Tagarampudi Issaku: 9999900000 / admin123
- Traveller: 9999911111 / demo123
- Shiva's Garage (mechanic): 9999922222 / provider123
- Shiva's Bunk (fuel): 9999933333 / provider123

## Run the story
1. Sign in as Traveller → pick 🔧 Mechanic or ⛽ Fuel → REQUEST HELP (real backend
   request, auto-matched to the nearest ACTIVE verified provider).
2. In another browser/tab, sign in as Shiva's Garage or Shiva's Bunk → ACCEPT REQUEST →
   SIMULATE MOVEMENT → ARRIVED → COMPLETE SERVICE.
3. Traveller tab updates live via Socket.IO: ETA countdown, status checklist, timeline.
4. Sign in as Admin → Live Monitor tab shows it all in real time; Providers tab manages
   the network (add/approve/suspend/delete); Demo Mode tab resets provider positions for
   repeat runs.

## Architecture
- backend/: Express + Socket.IO + better-sqlite3 (SQLite). Role checks are enforced
  server-side (JWT), never trusted from the frontend. Auto-seeds admin + demo providers
  on first run.
- frontend/: Vite + React + Tailwind v4, Socket.IO client.

DB file (backend/yatrakavach.db) is created and seeded automatically on first `npm start`.
