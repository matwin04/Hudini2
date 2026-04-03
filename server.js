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
reloadGtfs();
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
app.get("/api/reload",(req,res)=>{
  console.log("Done Reloading GTFS Data");
  res.json("done");
});
app.get("/api/test",(req,res)=>{
  res.render("map");
});
// metro areas from DB
/*app.get("/api/areas/db", (req, res) => {
  const rows = db.prepare("SELECT * FROM cities").all();
  res.json(rows);
});*/

// metro areas from JSON
app.get("/api/areas/json", async (req, res) => {
  const data = await fs.readFile("./public/data/metro-areas.json", "utf8");
  res.json(JSON.parse(data));
});
app.get("/api/bikes/:city", async (req, res) => {
  const city = req.params.city;

  const data = JSON.parse(await fs.readFile("./data/metro-areas.json", "utf8"));

  const metro = data.metroAreas[city];

  if (!metro || !metro.micromobility) {
    return res.json([]);
  }

  res.json(metro.micromobility);
});
app.get("/api/departures/motis/:stopId", async (req, res) => {
  const stopId = req.params.stopId;

  const data = await fetch(
    `https://transit.land/api/v2/rest/stops/${stopId}/departures?apikey=dViq8onyBCISi9OShVwn2jbv2WPysTsn`
  );

  res.json(data);
});
//
app.get("/api/departures/transitland/:stopId", async (req, res) => {
  const stopId = req.params.stopId;
  const data = await fetch(
    `https://transit.land/api/v2/rest/stops/${stopId}/departures?include_alerts=true&apikey=dViq8onyBCISi9OShVwn2jbv2WPysTs`
  );
  res.json(data);
});
app.get("/api/transit/overview", async (req, res) => {
  const city = req.params.city;
  const data = JSON.parse(await fs.readFile("./public/data/metro-areas.json", "utf8"));
  const metro = data.metroAreas[city];
  if (!metro || !metro.masstransit) {
    return res.json({});
  }
  res.json(metro.masstransit);
});
app.get("/api/transit/stops.geojson", async (req, res) => {
    const { stop_id } = req.query;
    const stops = stop_id ? getStopsAsGeoJSON(stop_id) : getStopsAsGeoJSON();
    res.json(stops);
});

/*app.get("/api/bikes", (req, res) => {
  const rows = db.prepare("SELECT * FROM bikeshare").all();
  res.json(rows);
});*/

app.listen(PORT, () => {
  console.log(`FastRoute running at http://localhost:${PORT}`);
});
