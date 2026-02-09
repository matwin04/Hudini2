# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hudini / FastRoute** is a multimodal journey planner for the San Francisco Bay Area. It helps users find the fastest routes across driving, public transit (BART, Muni metro, bus), and walking.

Currently an early-stage prototype: the frontend is functional with mock data, but backend services are not yet implemented.

## Running the Frontend

No build step or package manager is configured. Serve the frontend with any static HTTP server (required for geolocation API):

```bash
cd frontend && python3 -m http.server 8000
# Visit http://localhost:8000
```

## Architecture

**Frontend** (`frontend/`) — Single-page app using vanilla JS + Leaflet.js 1.9.4 (loaded via CDN from unpkg.com). Three source files: `index.html`, `script.js`, `style.css`.

- Map with three tile layers: Street (OpenStreetMap), Satellite (ArcGIS), Terrain (OpenTopoMap)
- Route visualization with color-coded polylines per transit mode
- Sidebar UI (420px, collapsible) with route timeline, segment breakdown, cost display
- Mock route generation in `generateMockRoute()` — intended to be replaced with a real API call to `/api/route` (see TODO comments at script.js lines ~309, ~316)
- Transit mode color scheme: drive `#4285f4`, metro/BART `#ea4335`, bus `#34a853`, walk `#9aa0a6`
- Google Material Design color palette, primary blue `#1a73e8`

**Planned backend services** (directories exist but are empty placeholders):
- `backend/` — Node.js/Express server entry point (`server.js` is empty)
- `APIServer/` — REST API for route planning
- `Database/` — Transit data and location storage
- `DataProcessing/` — Schedule parsing and route optimization
- `TileServer/` — Self-hosted map tiles

## Key Context

- No build system, package.json, linter, or test framework is set up yet
- Coordinates are hardcoded to San Francisco
- Frontend uses no frameworks — vanilla HTML/CSS/JS only
- External dependencies are CDN-only (Leaflet CSS + JS)
