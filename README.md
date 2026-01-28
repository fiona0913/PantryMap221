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

Files
- `frontend/index.html`: Root HTML with map container and side panel
- `frontend/styles.css`: Basic layout and responsive styles
- `frontend/app.js`: App bootstrap, map init, marker handling, panel updates
- `frontend/api.js`: Simple API layer with `getPantries()` (reads `frontend/pantries.json`)
- `frontend/pantries.json`: Real pantry data converted from `frontend/micropantries_all.csv`
- `frontend/micropantries_all.csv`: Source CSV with 335+ pantry locations

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
- Replace `getPantries` in `api.js` to call your backend (REST/GraphQL):
  - Keep the same return shape for drop-in compatibility
  - Or adapt in `normalizePantry(p)` inside `api.js`
- For real-time sensors, consider:
  - Server-Sent Events or WebSocket stream → call `updatePantryMarker(pantry)` and `renderDetails(pantry)` when updates arrive
  - Polling fallback (e.g., every 30–60s) if realtime isn’t ready

Marker Logic
- Marker color indicates pantry `status`
- Click opens detail panel with inventory and latest sensor readings
- Mobile: panel overlays map; Desktop: panel docks on the right

Development Notes
- Keep IDs stable across updates to preserve marker references
- If you add clustering or heatmap, do so in `app.js` behind a toggle
- All styles are minimal; feel free to enhance the UI kit later




