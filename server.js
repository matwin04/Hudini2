import express from "express";
import path from "path";
import { engine } from "express-handlebars";
import fs from "node:fs/promises";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { stoptimes, rentals, plan } from "@motis-project/motis-client";
import {
  exportGtfs,
  getAgencies,
  getCalendars,
  getFareAttributes,
  getFareMedia,
  getFareProducts,
  getFareRules,
  getRoutes,
  getServiceAlerts,
  getShapes,
  getShapesAsGeoJSON,
  getStopAttributes,
  getStops,
  getStopsAsGeoJSON,
  getStoptimes,
  getStopTimeUpdates,
  getTimetables,
  getTrips,
  getTripUpdates,
  getVehiclePositions,
  importGtfs,
  openDb,
  updateGtfsRealtime
} from "gtfs";
import { agency, trips } from "gtfs/models";

const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());

// folders
const VIEWS_DIR = path.join(__dirname, "views");
const PARTIALS_DIR = path.join(VIEWS_DIR, "partials");
const PUBLIC_DIR = path.join(__dirname, "public");
const GTFSCFG = JSON.parse(await fs.readFile(new URL("./public/data/socal.json", import.meta.url), "utf8"));
async function reloadGtfs() {
  await importGtfs(GTFSCFG);
}
const GEOJSON_DIR = path.join(PUBLIC_DIR, "data", "geojson");
openDb(GTFSCFG);
// handlebars
app.engine("html", engine({ extname: ".html", defaultLayout: false, partialsDir: PARTIALS_DIR }));
app.set("view engine", "html");
app.set("views", VIEWS_DIR);

// statics
app.use("/public", express.static(PUBLIC_DIR));

// home
app.get("/", (req, res) => {
  res.render("index");
});
app.get("/api/reload", (req, res) => {
  console.log("Done Reloading GTFS Data");
  res.json("done");
});
app.get("/api/test", (req, res) => {
  res.render("map");
});
// metro areas from DB
app.get("/api/agencies", async (req, res) => {
  try {
    const agencies = await fs.readdir(GEOJSON_DIR);
    const agencyList = [];

    for (const agency of agencies) {
      const agencyPath = path.join(GEOJSON_DIR, agency);
      const stats = await fs.stat(agencyPath);

      if (stats.isDirectory()) {
        agencyList.push({
          agencyKey: agency,
          testFile: `/public/data/geojson/${agency}/${agency}.geojson`,
          stopsFile: `/public/data/geojson/${agency}/stops.geojson`,
          shapesFile: `/public/data/geojson/${agency}/shapes.geojson`,
          mergedApi: `/api/agency/all.geojson?agencyKey=${encodeURIComponent(agency)}`
        });
      }
    }

    res.json({ agencies: agencyList });
  } catch (err) {
    console.error("Error listing agencies:", err);
    res.status(500).json({ error: "Failed to list agencies" });
  }
})

app.get("/api/agency/stops.geojson", async (req, res) => {
  try {
    const { agencyKey } = req.query;

    if (!agencyKey) {
      return res.status(400).json({ error: "agencyKey is required" });
    }

    const { stops } = await getAgencyGeoJSON(agencyKey);
    res.json(stops);
  } catch (err) {
    console.error("Error loading agency stops:", err);
    res.status(404).json({ error: "Agency stops not found" });
  }
});

app.get("/api/agency/shapes.geojson", async (req, res) => {
  try {
    const { agencyKey } = req.query;

    if (!agencyKey) {
      return res.status(400).json({ error: "agencyKey is required" });
    }

    const { shapes } = await getAgencyGeoJSON(agencyKey);
    res.json(shapes);
  } catch (err) {
    console.error("Error loading agency shapes:", err);
    res.status(404).json({ error: "Agency shapes not found" });
  }
});

app.get("/api/agency/all.geojson", async (req, res) => {
  try {
    const { agencyKey } = req.query;

    if (!agencyKey) {
      return res.status(400).json({ error: "agencyKey is required" });
    }

    const { stops, shapes } = await getAgencyGeoJSON(agencyKey);

    res.json({
      agencyKey,
      stops,
      shapes
    });
  } catch (err) {
    console.error("Error loading agency GeoJSON:", err);
    res.status(404).json({ error: "Agency GeoJSON not found" });
  }
});

app.get("/api/all-agencies.geojson", async (req, res) => {
  try {
    const agencyKeys = await listAgencyKeys();
    const result = {};

    for (const agencyKey of agencyKeys) {
      result[agencyKey] = await getAgencyGeoJSON(agencyKey);
    }

    res.json({
      agencies: result
    });
  } catch (err) {
    console.error("Error loading all agencies GeoJSON:", err);
    res.status(500).json({ error: "Failed to load all agencies GeoJSON" });
  }
});
app.get("/api/geocode",async (req, res) => {
  try {
    const {text} = req.query;
    const url = 'https://api.transitous.org/api/v1/geocode?text=Los%20Angeles&type=STOP';
    const options = {method: 'GET'};
    const response = await fetch(url, options);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Error loading geocode GeoJSON:", err);
    res.status(500).json({
      error: "Failed to get directions",
      details: err.message
    });
  }
})
app.get("/api/directions", async (req, res) => {
  try {
    const { fromPlace, toPlace, time } = req.query;

    const url =
        `https://api.transitous.org/api/v5/plan` +
        `?fromPlace=${fromPlace}` +
        `&toPlace=${toPlace}` +
        `&time=${time}` +
        `&withFares=true` +
        `&joinInterlinedLegs=true`
    ;

    console.log("MOTIS URL:", url);

    const response = await fetch(url);
    const data = await response.json();

    res.json(data);

  } catch (err) {
    console.error("MOTIS directions error:", err);
    res.status(500).json({
      error: "Failed to get directions",
      details: err.message
    });
  }
});
app.get("/api/stops", async (req, res) => {
  try {
    const { min, max } = req.query;

    const url = `https://api.transitous.org/api/v1/map/stops?min=${min}&max=${max}`;
    const testurl = "https://api.transitous.org/api/v1/map/stops?min=34.02,-118.30&max=34.07,-118.20";
    const otherurl = `https://external.transitapp.com/v3/public/nearby_stops?lat=34.0522&lon=-118.2437`
    const response = await fetch(url);
    const data = await response.json();

    // 🔥 YOUR API RETURNS AN ARRAY DIRECTLY
    const stops = Array.isArray(data) ? data : [];

    const geojson = {
      type: "FeatureCollection",
      features: stops.map(stop => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [
            Number(stop.lon),
            Number(stop.lat)
          ]
        },
        properties: {
          id: stop.stopId,

          name: stop.name,
          modes: stop.modes || []
        }
      }))
    };

    res.json(geojson);

  } catch (err) {
    console.error("Stops error:", err);
    res.status(500).json({ error: "Failed to fetch stops" });
  }
});
app.get("/api/map/trips", async (req, res) => {
  const url = 'https://api.transitous.org/api/v5/map/trips?min=34.02%2C-118.30&max=34.07%2C-118.20&zoom=12&startTime=2019-08-24T14%3A15%3A22Z&endTime=2026-08-24T14%3A15%3A22Z';
  const options = {method: 'GET'};
  const response = await fetch(url, options);
  const data = await response.json();
  res.json(data);
})
app.get("/api/nearby-stops", async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: "Missing lat/lon" });
    }

    const url =
        `https://external.transitapp.com/v3/public/nearby_stops` +
        `?lat=${encodeURIComponent(lat)}` +
        `&lon=${encodeURIComponent(lon)}`;

    const response = await fetch(url, {
      headers: {
        apikey: "transit_publicapi_v3_925a82bfb345a06cbb109529a1f456489aac078b81489984d5ad04d8dadac9df"
      }
    });

    const data = await response.json();

    // 🔥 Convert to GeoJSON
    const stops = data.stops || [];

    const geojson = {
      type: "FeatureCollection",
      features: stops.map(stop => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [stop.lon, stop.lat]
        },
        properties: {
          id: stop.global_stop_id,
          name: stop.stop_name,
          code: stop.stop_code,
          routes: stop.routes || []
        }
      }))
    };

    res.json(geojson);

  } catch (err) {
    console.error("Nearby stops error:", err);
    res.status(500).json({ error: "Failed to fetch nearby stops" });
  }
});
app.listen(PORT, () => {
  console.log(`FastRoute running at http://localhost:${PORT}`);
});
