let metroAreas = {};

const baseStyles = {
    street: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    satellite: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    terrain: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
};

let map;
let origin = null;
let destination = null;

function setOrigin(stopId, lng, lat) {
    origin = { stopId, coords: [lng, lat] };
    console.log("Origin:", origin);
}

function setDestination(stopId, lng, lat) {
    destination = { stopId, coords: [lng, lat] };
    console.log("Destination:", destination);
}

async function viewDepartures(stopId) {
    console.log("Fetching departures for:", stopId);

    document.getElementById("noRoute").style.display = "none";
    document.getElementById("fastestRoute").style.display = "none";
    document.getElementById("alternatives").style.display = "none";

    const section = document.getElementById("departuresSection");
    const list = document.getElementById("departuresList");

    section.style.display = "block";
    list.innerHTML = "<p>Loading departures...</p>";

    try {
        const res = await fetch(`/api/departures/transitland/${stopId}`);
        const data = await res.json();

        renderDepartures(data);
    } catch (err) {
        console.error(err);
        list.innerHTML = "<p>Error loading departures</p>";
    }
}

function renderDepartures(data) {
    const list = document.getElementById("departuresList");
    list.innerHTML = "";

    if (!data || data.length === 0) {
        list.innerHTML = "<p>No departures found</p>";
        return;
    }

    data.forEach((dep) => {
        const div = document.createElement("div");
        div.className = "departure-card";

        div.innerHTML = `
            <div class="dep-left">
                <div class="dep-route" style="background:#${dep.route_color || "666"}">
                    ${dep.route_short_name || ""}
                </div>
            </div>

            <div class="dep-middle">
                <div class="dep-destination">
                    ${dep.trip_headsign || "Unknown"}
                </div>
                <div class="dep-time">
                    ${formatTime(dep.departure_time)}
                </div>
            </div>

            <div class="dep-right">
                ${getMinutesAway(dep.departure_time)} min
            </div>
        `;

        list.appendChild(div);
    });
}

async function getMetroAreas() {
    const response = await fetch("/public/data/metro-areas.json");
    const data = await response.json();
    return data.metroAreas;
}

async function init() {
    metroAreas = await getMetroAreas();

    map = new maplibregl.Map({
        container: "map",
        style: baseStyles.terrain,
        center: metroAreas.LA.coords,
        zoom: metroAreas.LA.zoom
    });

    map.on("load", () => {
        addTransitLayers();
        loadTransitStops();
        enableTransitPopups();
    });
}

function switchMetro(city) {
    const metro = metroAreas[city];
    if (!metro) return;

    map.flyTo({
        center: metro.coords,
        zoom: metro.zoom,
        speed: 0.8
    });
}

function addTransitLayers() {
    map.addSource("transit-routes", {
        type: "vector",
        tiles: [
            "https://transit.land/api/v2/tiles/routes/tiles/{z}/{x}/{y}.pbf?apikey=WOo9vL8ECMWN76EcKjsNGfo8YgNZ7c2u"
        ],
        minzoom: 0,
        maxzoom: 14
    });

    map.addLayer({
        id: "subway-lines",
        type: "line",
        source: "transit-routes",
        "source-layer": "routes",
        filter: ["==", ["get", "route_type"], 1],
        paint: {
            "line-color": ["get", "route_color"],
            "line-width": 3,
            "line-opacity": 0.9
        }
    });

    map.addLayer({
        id: "rail-lines",
        type: "line",
        source: "transit-routes",
        "source-layer": "routes",
        filter: ["==", ["get", "route_type"], 2],
        paint: {
            "line-color": ["get", "route_color"],
            "line-width": 3,
            "line-opacity": 0.9
        }
    });

    map.addLayer({
        id: "tram-lines",
        type: "line",
        source: "transit-routes",
        "source-layer": "routes",
        filter: ["==", ["get", "route_type"], 0],
        paint: {
            "line-color": ["get", "route_color"],
            "line-width": 3,
            "line-opacity": 0.9
        }
    });
}
function loadTransitStops() {
    map.addSource("stops", {
        type: "geojson",
        data: "/api/transit/stops.geojson"
    });
    map.addLayer({
        id: "metro-stops-layer",
        type: "circle",
        source: "stops",
        filter: ["==", ["get", "location_type"], 0],
        paint: {
            "circle-radius": 5,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#111111",
            "circle-stroke-width": 2
        }
    });
}

function enableTransitPopups() {
    map.on("mouseenter", "metro-stops-layer", () => {
        map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "metro-stops-layer", () => {
        map.getCanvas().style.cursor = "";
    });

    map.on("click", "metro-stops-layer", (e) => {
        
        const f = e.features[0];

        const coords = f.geometry.coordinates.slice();
        const props = f.properties;

        const stopName = props.stop_name || "Unknown stop";
        console.log(`Getting Children for ${stopName}`);
        const stopId = props.stop_id;
        console.log(stopId);
        new maplibregl.Popup()
        .setLngLat(coords)
        .setHTML(`
            <div class="popup">
                <b>${stopName}</b><br>
                Stop ID: ${stopId}<br><br>
                <button>View Departures</button>
            </div>
        `)
        .addTo(map);
    });
}

function formatTime(timeStr) {
    if (!timeStr) return "--:--";

    const [h, m] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setHours(h % 24, m, 0, 0);

    return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
}

function getMinutesAway(timeStr) {
    if (!timeStr) return "--";

    const [h, m] = timeStr.split(":").map(Number);
    const now = new Date();
    const dep = new Date();

    dep.setHours(h % 24, m, 0, 0);

    if (h >= 24) {
        dep.setDate(dep.getDate() + Math.floor(h / 24));
    }

    return Math.max(0, Math.round((dep - now) / 60000));
}
function showStopPopup(e) {
    const f = e.features[0];
    const p = f.properties;
    const station_info = document.getElementById("station-info");
    station_info.innerHTML = `
        <div class="stop_name">${p.stop_name}</div>
        ${p.stop_id}<br>
        
    `;
}
init();
