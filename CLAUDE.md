# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hudini / FastRoute** is a multimodal journey planner for the San Francisco Bay Area. It helps users find the fastest routes across driving, public transit (BART), and walking.

## Running the App

```bash
cd backend && npm install && npm start
# Visit http://localhost:3000
```

The Express server serves both the API and the frontend static files from `frontend/`.

## Architecture

**Frontend** (`frontend/`) — Single-page app using vanilla JS + Leaflet.js 1.9.4 (loaded via CDN from unpkg.com). Three source files: `index.html`, `script.js`, `style.css`.

- Map with three tile layers: Street (OpenStreetMap), Satellite (ArcGIS), Terrain (OpenTopoMap)
- Route visualization with color-coded polylines per transit mode (walk segments use dashed lines)
- Sidebar UI (420px, collapsible) with route timeline, segment breakdown, cost display
- Calls `POST /api/route` with `{ start, end, time }` to get multimodal routes
- Loading and error states for route requests
- Transit mode color scheme: drive `#4285f4`, metro/BART `#ea4335`, bus `#34a853`, walk `#9aa0a6`
- Google Material Design color palette, primary blue `#1a73e8`

**Backend** (`backend/`) — Node.js/Express server with multimodal routing engine.

- `server.js` — Express server, serves frontend static files and API endpoints
- `routing.js` — Multimodal routing orchestration: geocoding, OSRM driving routes, BART pathfinding, route combination and comparison
- `bart.js` — Complete BART station data (50+ stations with coordinates), adjacency graph, Dijkstra shortest path, fare calculation

**API Endpoints:**
- `POST /api/route` — Find multimodal routes. Body: `{ start: string, end: string, time?: string }`. Returns fastest route with segments + alternatives.
- `GET /api/geocode?q=<query>` — Geocode a place name to coordinates (uses Nominatim, bounded to SF Bay Area)

**External Services (no API keys needed):**
- [OSRM](https://router.project-osrm.org) — Open Source Routing Machine for real road-geometry driving routes
- [Nominatim](https://nominatim.openstreetmap.org) — OpenStreetMap geocoding for address → coordinate conversion

**Unused placeholder directories** (not yet implemented):
- `APIServer/`, `Database/`, `DataProcessing/`, `TileServer/`

## Key Context

- Node.js 18+ required (uses native `fetch`)
- Only npm dependency is `express`
- Frontend uses no frameworks — vanilla HTML/CSS/JS only
- External frontend dependencies are CDN-only (Leaflet CSS + JS)
- BART station data and travel times are hardcoded in `bart.js`
- OSRM demo server is rate-limited; routing module includes delays between requests
