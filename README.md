Connected Micro Pantry Platform — Map Dashboard Prototype

Overview
- Web-based map showing pantry locations (fake data for now)
- Click markers to open a detail side panel
- Built with Leaflet; ready to swap in real APIs and sensor data later

Quick Start
1. Enter the frontend bundle: `cd frontend`
2. Use a simple static server (needed due to Leaflet asset loading and fetch):
   - Python 3: `python3 -m http.server 3000`
   - Node: `npx serve -l 3000 .`
3. Open `http://localhost:3000` in your browser.
4. Click on any green marker to view pantry details with photos and information.

Backend (two options)
- `functions-backend/` (Azure Functions, **default for local dev**): the frontend is configured to call `http://localhost:7071/api` (see `frontend/api.js`). For end-to-end local instructions, see `run_local.md`.
- `backend/` (Express, legacy): still used by some container/CI deployment scripts and runs on port `5000`, but it is not the default local dev path.

Files
- **前端入口**：`frontend/index.html`（单一页面端入口；访问根路径 `/` 时由静态服务返回该页）
- `frontend/index.html`: Root HTML with map container and side panel
- `frontend/styles.css`: Basic layout and responsive styles
- `frontend/app.js`: App bootstrap, map init, marker handling, panel updates
- `frontend/api.js`: Simple API layer with `getPantries()` (reads `frontend/pantries.json`)
- `frontend/pantries.json`: Real pantry data converted from `legacy/frontend-data/micropantries_all.csv`
- `legacy/frontend-data/micropantries_all.csv`: Source CSV with 335+ pantry locations (kept for reference)

Legacy
- `legacy/app.js`, `legacy/api.js`: Deprecated copies that used to live in the repo root. Use the `frontend/` versions instead.
- `legacy/frontend-data/mockData.json`: Deprecated demo dataset (not used by the app).
- `legacy/fetch_data.py`: Optional Python script to pull telemetry from Azure SQL and write `pantry_data.json`; run from project root as `python legacy/fetch_data.py`. The app prefers the Azure Functions API and uses `frontend/pantry_data.json` as fallback.
- `legacy/served_page_3000.html`: Snapshot of sensor history page (dev/test, not used by the app).
- `legacy/pantry_data.json`: Backup copy of telemetry data; the live copy used by the frontend is `frontend/pantry_data.json`.

Data Contract (initial)
- Pantry object (example):
  - `id`: string
  - `name`: string
  - `status`: "open" | "closed" | "low-inventory"
  - `address`: string
  - `location`: { `lat`: number, `lng`: number }
  - `inventory`: { `categories`: Array<{ name: string, quantity: number }> }
  - `sensors`: { `weightKg`: number, `lastDoorEvent`: string, `updatedAt`: string }
  - `contact`: { `owner`: string, `phone`: string }

Swapping to Real Data
- Update `frontend/api.js` to call your backend (REST/GraphQL):
  - Keep the same return shape for drop-in compatibility
  - Or adapt in `normalizePantry(p)` inside `frontend/api.js`
- For real-time sensors, consider:
  - Server-Sent Events or WebSocket stream → call `window.PantryMap.updatePantryMarker(pantry)` (and optionally refresh the open panel via `window.PantryMap.showPantryDetails(pantry)`) when updates arrive
  - Polling fallback (e.g., every 30–60s) if realtime isn’t ready

Marker Logic
- Marker color indicates pantry `status`
- Click opens detail panel with inventory and latest sensor readings
- Mobile: panel overlays map; Desktop: panel docks on the right

Development Notes
- Keep IDs stable across updates to preserve marker references
- If you add clustering or heatmap, do so in `frontend/app.js` behind a toggle
- All styles are minimal; feel free to enhance the UI kit later




