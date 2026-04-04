let metroAreas = {};

const baseStyles = {
    street: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    satellite: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    terrain: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
};

let map;
let origin = null;
let destination = null;
let allStops = [];
let searchMarker = null;
let routeLayerIds = [];
let routeSourceIds = [];
let transitVisible = true;
let sidebarCollapsed = false;

const MODE_ICONS = {
    WALK: "🚶",
    BUS: "🚌",
    TRAM: "🚊",
    SUBWAY: "🚇",
    RAIL: "🚆",
    GONDOLA: "🚠",
    FERRY: "⛴️",
    CAR: "🚗",
    BICYCLE: "🚲"
};

function setOrigin(stopId) {
    origin = stopId;
    document.getElementById("startPoint").value = stopId;
    updateClearButtons();
}

function setDestination(stopId) {
    destination = stopId;
    document.getElementById("endPoint").value = stopId;
    updateClearButtons();
}

function clearOrigin() {
    origin = null;
    document.getElementById("startPoint").value = "";
    updateClearButtons();
}

function clearDestination() {
    destination = null;
    document.getElementById("endPoint").value = "";
    updateClearButtons();
}

function updateClearButtons() {
    const startPoint = document.getElementById("startPoint");
    const endPoint = document.getElementById("endPoint");
    const clearStart = document.getElementById("clearStart");
    const clearEnd = document.getElementById("clearEnd");
    
    if (clearStart) clearStart.style.display = startPoint.value ? "block" : "none";
    if (clearEnd) clearEnd.style.display = endPoint.value ? "block" : "none";
    
    startPoint.classList.toggle("has-clear", !!startPoint.value);
    endPoint.classList.toggle("has-clear", !!endPoint.value);
}

async function getDirections() {
    if (!origin || !destination) {
        alert("Pick an origin and destination first");
        return;
    }
    
    try {
        const departureTimeInput = document.getElementById("departureTime");
        const params = new URLSearchParams({
            from: origin,
            to: destination
        });
        
        if (departureTimeInput && departureTimeInput.value) {
            params.set("time", departureTimeInput.value);
        }
        
        const res = await fetch(`/api/directions?${params.toString()}`);
        const data = await res.json();
        
        if (!res.ok) {
            console.error("Directions error:", data);
            alert(data.error || "Failed to get directions");
            return;
        }
        
        document.getElementById("noRoute").style.display = "none";
        document.getElementById("departuresSection").style.display = "none";
        
        renderDirections(data);
    } catch (err) {
        console.error(err);
        alert("Network error while getting directions");
    }
}

async function viewDepartures(stopId) {
    document.getElementById("noRoute").style.display = "none";
    document.getElementById("fastestRoute").style.display = "none";
    document.getElementById("alternatives").style.display = "none";
    
    const section = document.getElementById("departuresSection");
    const list = document.getElementById("departuresList");
    const stationName = document.getElementById("departureStationName");
    
    section.style.display = "block";
    list.innerHTML = "<p>Loading departures...</p>";
    stationName.textContent = stopId;
    
    try {
        const res = await fetch(`/api/departures?stopId=${stopId}`);
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
    
    const departures =
    Array.isArray(data) ? data :
    Array.isArray(data?.departures) ? data.departures :
    Array.isArray(data?.stop_departures) ? data.stop_departures :
    [];
    
    if (!departures.length) {
        list.innerHTML = "<p>No departures found</p>";
        return;
    }
    
    departures.forEach((dep) => {
        const div = document.createElement("div");
        div.className = "departure-card";
        
        const rawColor = dep.route_color || dep.route?.route_color || "666666";
        const bgColor = rawColor.startsWith("#") ? rawColor : `#${rawColor}`;
        
        div.innerHTML = `
            <div class="dep-left">
                <div class="dep-route" style="background:${bgColor}">
                    ${dep.route_short_name || dep.route?.route_short_name || ""}
        </div>
        </div>
        
        <div class="dep-middle">
        <div class="dep-destination">
        ${dep.trip_headsign || dep.headsign || "Unknown"}
        </div>
        <div class="dep-time">
        ${formatTime(dep.departure_time || dep.departure?.scheduled_time)}
        </div>
        </div>
        
        <div class="dep-right">
        ${getMinutesAway(dep.departure_time || dep.departure?.scheduled_time)} min
        </div>
        `;

        list.appendChild(div);
    });
}

function renderDirections(data) {
    const itineraries = data.itineraries || data.plan?.itineraries || [];

    const fastestRoute = document.getElementById("fastestRoute");
    const alternatives = document.getElementById("alternatives");
    const noRoute = document.getElementById("noRoute");
    const totalTime = document.getElementById("totalTime");
    const routeCost = document.getElementById("routeCost");
    const routeTimeline = document.getElementById("routeTimeline");
    const routeSegments = document.getElementById("routeSegments");
    const alternativesList = document.getElementById("alternativesList");

    routeTimeline.innerHTML = "";
    routeSegments.innerHTML = "";
    alternativesList.innerHTML = "";

    if (!itineraries.length) {
        fastestRoute.style.display = "none";
        alternatives.style.display = "none";
        noRoute.style.display = "block";
        clearRouteLines();
        document.getElementById("routeLegend").style.display = "none";
        return;
    }

    const fastest = itineraries[0];

    noRoute.style.display = "none";
    fastestRoute.style.display = "block";
    alternatives.style.display = itineraries.length > 1 ? "block" : "none";

    totalTime.textContent = `${getItineraryDurationMinutes(fastest)} min`;
    routeCost.textContent = getFareText(fastest);

    renderTimeline(fastest, routeTimeline);
    renderSegments(fastest, routeSegments);
    drawItineraryOnMap(fastest);

    itineraries.slice(1).forEach((itinerary, i) => {
        const index = i + 1;
        const card = document.createElement("div");
        card.className = "route-card alternative-card";
        card.innerHTML = `
        <div class="route-header">
        <div class="route-badge">ALT ${index}</div>
        <div class="route-time">${getItineraryDurationMinutes(itinerary)} min</div>
        </div>
        <div class="route-footer">
        <div>${buildMiniLegSummary(itinerary)}</div>
        <button class="view-details-btn" data-itinerary-index="${index}">Use This Route</button>
        </div>
        `;
        alternativesList.appendChild(card);
    });

    alternativesList.querySelectorAll("[data-itinerary-index]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const index = Number(btn.dataset.itineraryIndex);
            const itinerary = itineraries[index];

            totalTime.textContent = `${getItineraryDurationMinutes(itinerary)} min`;
            routeCost.textContent = getFareText(itinerary);
            routeTimeline.innerHTML = "";
            routeSegments.innerHTML = "";

            renderTimeline(itinerary, routeTimeline);
            renderSegments(itinerary, routeSegments);
            drawItineraryOnMap(itinerary);
        });
    });
}

function renderTimeline(itinerary, container) {
    const legs = itinerary.legs || [];

    legs.forEach((leg, i) => {
        const item = document.createElement("div");
        item.className = "timeline-leg";

        const mode = getLegMode(leg);
        const icon = MODE_ICONS[mode] || "➡️";
        const color = getLegColor(leg);

        item.innerHTML = `
        <span class="timeline-dot-inline" style="background:${color}"></span>
        <span>${icon}</span>
        <span>${getLegLabel(leg)}</span>
        ${i < legs.length - 1 ? '<span class="timeline-arrow">→</span>' : ""}
        `;

        container.appendChild(item);
    });
}

function renderSegments(itinerary, container) {
    const legs = itinerary.legs || [];

    legs.forEach((leg) => {
        const mode = getLegMode(leg).toLowerCase();
        const icon = MODE_ICONS[getLegMode(leg)] || "➡️";
        const color = getLegColor(leg);

        const fromName = leg.from?.name || leg.from?.stop?.name || leg.from?.place?.name || "Start";
        const toName = leg.to?.name || leg.to?.stop?.name || leg.to?.place?.name || "End";
        const startTime = formatIsoOrOtpTime(leg.startTime || leg.start_time);
        const endTime = formatIsoOrOtpTime(leg.endTime || leg.end_time);

        const card = document.createElement("div");
        card.className = `segment ${mode}`;
        card.style.borderLeftColor = color;

        card.innerHTML = `
        <div class="segment-icon">${icon}</div>
        <div class="segment-info">
        <div class="segment-mode">${getLegLabel(leg)}</div>
        <div class="segment-details">${fromName} → ${toName}</div>
        <div class="segment-details">${startTime} - ${endTime}</div>
        </div>
        <div class="segment-time">${getLegDurationMinutes(leg)} min</div>
        `;

        container.appendChild(card);
    });
}

function buildMiniLegSummary(itinerary) {
    return (itinerary.legs || [])
        .map((leg) => `${MODE_ICONS[getLegMode(leg)] || "➡️"} ${getLegShortName(leg)}`)
        .join(" ");
}

function getLegMode(leg) {
    return leg.mode || leg.transitMode || leg.routeType || "WALK";
}

function getLegShortName(leg) {
    return (
        leg.routeShortName ||
        leg.route_short_name ||
        leg.routeLongName ||
        leg.route_long_name ||
        leg.headsign ||
        getLegMode(leg)
    );
}

function getLegLabel(leg) {
    const mode = getLegMode(leg);
    const shortName = getLegShortName(leg);

    if (mode === "WALK") return "Walk";
    if (shortName && shortName !== mode) return `${mode} ${shortName}`;
    return mode;
}

function getLegColor(leg) {
    const raw = leg.routeColor || leg.route_color;

    if (raw) return raw.startsWith("#") ? raw : `#${raw}`;

    const mode = getLegMode(leg);
    if (mode === "WALK") return "#9aa0a6";
    if (mode === "BUS") return "#34a853";
    if (mode === "TRAM") return "#fbbc05";
    if (mode === "SUBWAY") return "#ea4335";
    if (mode === "RAIL") return "#4285f4";
    return "#666666";
}

function getItineraryDurationMinutes(itinerary) {
    if (typeof itinerary.duration === "number") return Math.round(itinerary.duration / 60);
    if (typeof itinerary.durationMinutes === "number") return itinerary.durationMinutes;

    const start = itinerary.startTime || itinerary.start_time;
    const end = itinerary.endTime || itinerary.end_time;

    if (start && end) {
        return Math.round((new Date(end) - new Date(start)) / 60000);
    }

    return "?";
}

function getLegDurationMinutes(leg) {
    if (typeof leg.duration === "number") return Math.round(leg.duration / 60);

    const start = leg.startTime || leg.start_time;
    const end = leg.endTime || leg.end_time;

    if (start && end) {
        return Math.round((new Date(end) - new Date(start)) / 60000);
    }

    return "?";
}

function getFareText(itinerary) {
    const fare = itinerary.fare?.fare?.regular?.cents ?? itinerary.fare?.cents ?? itinerary.fare?.amount;
    if (fare == null) return "💰 Fare unavailable";
    if (fare > 20) return `💰 $${(fare / 100).toFixed(2)}`;
    return `💰 $${Number(fare).toFixed(2)}`;
}

function clearRouteLines() {
    routeLayerIds.forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
    });

    routeSourceIds.forEach((id) => {
        if (map.getSource(id)) map.removeSource(id);
    });

    routeLayerIds = [];
    routeSourceIds = [];
}

function normalizeCoords(coords) {
    if (!Array.isArray(coords)) return [];

    return coords
        .map((c) => {
            if (!Array.isArray(c) || c.length < 2) return null;

            const a = Number(c[0]);
            const b = Number(c[1]);

            if (Number.isNaN(a) || Number.isNaN(b)) return null;

            if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [b, a];
            return [a, b];
        })
        .filter(Boolean);
}

function drawItineraryOnMap(itinerary) {
    clearRouteLines();

    const bounds = new maplibregl.LngLatBounds();
    let hasCoords = false;

    (itinerary.legs || []).forEach((leg, i) => {
        const coords = getLegCoordinates(leg);
        if (!coords.length) return;

        const sourceId = `route-source-${i}`;
        const layerId = `route-layer-${i}`;
        const color = getLegColor(leg);
        const isWalk = getLegMode(leg) === "WALK";

        map.addSource(sourceId, {
            type: "geojson",
            data: {
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: coords
                },
                properties: {
                    mode: getLegMode(leg)
                }
            }
        });

        map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            layout: {
                "line-cap": "round",
                "line-join": "round"
            },
            paint: {
                "line-color": color,
                "line-width": isWalk ? 4 : 6,
                "line-opacity": 0.95,
                "line-dasharray": isWalk ? [2, 2] : [1, 0]
            }
        });

        routeSourceIds.push(sourceId);
        routeLayerIds.push(layerId);

        coords.forEach((c) => {
            bounds.extend(c);
            hasCoords = true;
        });
    });

    document.getElementById("routeLegend").style.display = hasCoords ? "block" : "none";

    if (hasCoords) {
        map.fitBounds(bounds, { padding: 60, duration: 800 });
    }
}

function getLegCoordinates(leg) {
    if (typeof leg?.legGeometry?.points === "string") {
        return decodePolyline(leg.legGeometry.points, 5);
    }

    if (typeof leg?.leg_geometry?.points === "string") {
        return decodePolyline(leg.leg_geometry.points, 5);
    }

    if (typeof leg?.geometry?.points === "string") {
        return decodePolyline(leg.geometry.points, 5);
    }

    if (Array.isArray(leg?.geometry?.coordinates)) {
        return normalizeCoords(leg.geometry.coordinates);
    }

    if (Array.isArray(leg?.legGeometry?.coordinates)) {
        return normalizeCoords(leg.legGeometry.coordinates);
    }

    if (Array.isArray(leg?.leg_geometry?.coordinates)) {
        return normalizeCoords(leg.leg_geometry.coordinates);
    }

    const fromLon = leg?.from?.lon ?? leg?.from?.stop?.lon ?? leg?.from?.place?.lon;
    const fromLat = leg?.from?.lat ?? leg?.from?.stop?.lat ?? leg?.from?.place?.lat;
    const toLon = leg?.to?.lon ?? leg?.to?.stop?.lon ?? leg?.to?.place?.lon;
    const toLat = leg?.to?.lat ?? leg?.to?.stop?.lat ?? leg?.to?.place?.lat;

    if (fromLon != null && fromLat != null && toLon != null && toLat != null) {
        return [
            [Number(fromLon), Number(fromLat)],
            [Number(toLon), Number(toLat)]
        ];
    }

    return [];
}

function decodePolyline(str, precision = 5) {
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates = [];
    const factor = Math.pow(10, precision);

    while (index < str.length) {
        let b;
        let shift = 0;
        let result = 0;

        do {
            b = str.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += dlat;

        shift = 0;
        result = 0;

        do {
            b = str.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += dlng;

        coordinates.push([lng / factor, lat / factor]);
    }

    return coordinates;
}

function formatIsoOrOtpTime(value) {
    if (!value) return "--:--";

    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    return String(value);
}

function formatTime(timeStr) {
    if (!timeStr) return "--:--";

    if (String(timeStr).includes("T")) {
        const d = new Date(timeStr);
        if (!Number.isNaN(d.getTime())) {
            return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        }
    }

    const [h, m] = String(timeStr).split(":").map(Number);
    const date = new Date();
    date.setHours(h % 24, m, 0, 0);

    return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
}

function getMinutesAway(timeStr) {
    if (!timeStr) return "--";

    let dep;

    if (String(timeStr).includes("T")) {
        dep = new Date(timeStr);
    } else {
        const [h, m] = String(timeStr).split(":").map(Number);
        dep = new Date();
        dep.setHours(h % 24, m, 0, 0);
        if (h >= 24) {
            dep.setDate(dep.getDate() + Math.floor(h / 24));
        }
    }

    const now = new Date();
    return Math.max(0, Math.round((dep - now) / 60000));
}

async function getMetroAreas() {
    const response = await fetch("/public/data/metro-areas.json");
    const data = await response.json();
    return data.metroAreas;
}

async function loadTransitStops() {
    const res = await fetch("/api/transit/stops.geojson");
    const geojson = await res.json();

    allStops = geojson.features || [];

    map.addSource("stops", {
        type: "geojson",
        data: geojson
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

function addTransitLayers() {
    if (map.getSource("transit-routes")) return;

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

        new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            maxWidth: "320px",
            className: "station-popup-wrap"
        })
            .setLngLat(coords)
            .setHTML(`
        <div class="station-popup">
        <div class="station-popup__title">${props.stop_name || "Unknown stop"}</div>
        <div class="station-popup__meta">Stop ID: ${props.stop_id || ""}</div>
        <div class="station-popup__meta">Code: ${props.stop_code || "—"}</div>
        <div class="station-popup__actions">
        <button class="station-popup__btn station-popup__btn--ghost" onclick="viewDepartures('${props.stop_id}')">View Departures</button>
        <button class="station-popup__btn station-popup__btn--primary" onclick="setOrigin('${props.stop_id}')">Set Origin</button>
        <button class="station-popup__btn station-popup__btn--primary" onclick="setDestination('${props.stop_id}')">Set Destination</button>
        </div>
        </div>
        `)
            .addTo(map);
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

function searchStops(query) {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    return allStops.find((f) => {
        const p = f.properties || {};
        return (
            (p.stop_name || "").toLowerCase().includes(q) ||
            (p.stop_id || "").toLowerCase().includes(q) ||
            (p.stop_code || "").toLowerCase().includes(q)
        );
    });
}

function goToSearchResult(feature) {
    if (!feature) return;

    const coords = feature.geometry.coordinates.slice();
    const props = feature.properties || {};

    map.flyTo({
        center: coords,
        zoom: 15,
        speed: 0.9
    });

    if (searchMarker) searchMarker.remove();

    searchMarker = new maplibregl.Marker()
        .setLngLat(coords)
        .addTo(map);

    new maplibregl.Popup({
        maxWidth: "320px",
        className: "station-popup-wrap"
    })
        .setLngLat(coords)
        .setHTML(`
        <div class="station-popup">
        <div class="station-popup__title">${props.stop_name || "Unknown stop"}</div>
        <div class="station-popup__meta">Stop ID: ${props.stop_id || ""}</div>
        <div class="station-popup__meta">Code: ${props.stop_code || "—"}</div>
        <div class="station-popup__actions">
        <button class="station-popup__btn station-popup__btn--ghost" onclick="viewDepartures('${props.stop_id}')">View Departures</button>
        <button class="station-popup__btn station-popup__btn--primary" onclick="setOrigin('${props.stop_id}')">Set Origin</button>
        <button class="station-popup__btn station-popup__btn--primary" onclick="setDestination('${props.stop_id}')">Set Destination</button>
        </div>
        </div>
        `)
        .addTo(map);
}

function toggleSidebar(forceState) {
    const body = document.body;
    sidebarCollapsed = typeof forceState === "boolean" ? forceState : !sidebarCollapsed;
    body.classList.toggle("sidebar-collapsed", sidebarCollapsed);

    setTimeout(() => {
        if (map) map.resize();
    }, 320);
}

function setBaseLayer(layerName) {
    if (!baseStyles[layerName]) return;

    map.setStyle(baseStyles[layerName]);

    map.once("style.load", async () => {
        addTransitLayers();
        await reloadStopsLayer();
        restoreTransitVisibility();
        redrawCurrentRoute();
    });

    document.querySelectorAll(".layer-btn[data-layer]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.layer === layerName);
    });
}

async function reloadStopsLayer() {
    if (map.getLayer("metro-stops-layer")) map.removeLayer("metro-stops-layer");
    if (map.getSource("stops")) map.removeSource("stops");
    await loadTransitStops();
    enableTransitPopups();
}

function restoreTransitVisibility() {
    const visibility = transitVisible ? "visible" : "none";

    ["subway-lines", "rail-lines", "tram-lines", "metro-stops-layer"].forEach((id) => {
        if (map.getLayer(id)) {
            map.setLayoutProperty(id, "visibility", visibility);
        }
    });
}

function toggleTransit() {
    transitVisible = !transitVisible;
    restoreTransitVisibility();
    document.getElementById("transitToggle").classList.toggle("active", transitVisible);
}

function redrawCurrentRoute() {
    const routeSegments = document.getElementById("routeSegments");
    if (routeSegments && routeSegments.children.length) {
        document.getElementById("getDirections").click();
    }
}

function bindUI() {
    document.getElementById("getDirections").addEventListener("click", getDirections);
    document.getElementById("metroSelect").addEventListener("change", (e) => switchMetro(e.target.value));
    document.getElementById("clearStart").addEventListener("click", clearOrigin);
    document.getElementById("clearEnd").addEventListener("click", clearDestination);
    document.getElementById("startPoint").addEventListener("input", updateClearButtons);
    document.getElementById("endPoint").addEventListener("input", updateClearButtons);

    document.getElementById("backToRoutes").addEventListener("click", () => {
        document.getElementById("departuresSection").style.display = "none";
        if (origin && destination) {
            document.getElementById("fastestRoute").style.display = "block";
            document.getElementById("alternatives").style.display = "block";
        } else {
            document.getElementById("noRoute").style.display = "block";
        }
    });

    const searchBox = document.getElementById("searchBox");
    const clearSearch = document.getElementById("clearSearch");

    searchBox.addEventListener("input", () => {
        clearSearch.style.display = searchBox.value ? "block" : "none";
    });

    searchBox.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;

        const feature = searchStops(searchBox.value);
        if (!feature) {
            alert("No matching station found");
            return;
        }
        goToSearchResult(feature);
    });

    clearSearch.addEventListener("click", () => {
        searchBox.value = "";
        clearSearch.style.display = "none";
        if (searchMarker) {
            searchMarker.remove();
            searchMarker = null;
        }
    });

    document.getElementById("menuBtn").addEventListener("click", () => toggleSidebar());

    document.querySelectorAll(".layer-btn[data-layer]").forEach((btn) => {
        btn.addEventListener("click", () => setBaseLayer(btn.dataset.layer));
    });

    document.getElementById("transitToggle").addEventListener("click", toggleTransit);

    document.getElementById("zoomIn").addEventListener("click", () => map.zoomIn());
    document.getElementById("zoomOut").addEventListener("click", () => map.zoomOut());

    document.getElementById("myLocation").addEventListener("click", () => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                map.flyTo({
                    center: [pos.coords.longitude, pos.coords.latitude],
                    zoom: 14,
                    speed: 0.9
                });
            },
            () => alert("Could not get your location")
        );
    });

    document.getElementById("toggle-stations").addEventListener("change", (e) => {
        if (map.getLayer("metro-stops-layer")) {
            map.setLayoutProperty("metro-stops-layer", "visibility", e.target.checked ? "visible" : "none");
        }
    });

    document.getElementById("toggle-rail").addEventListener("change", (e) => {
        const visibility = e.target.checked ? "visible" : "none";
        ["subway-lines", "rail-lines", "tram-lines"].forEach((id) => {
            if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
        });
    });

    document.getElementById("toggle-bikes").addEventListener("change", () => {
        // placeholder for future bikes layer
    });
}

async function init() {
    metroAreas = await getMetroAreas();

    map = new maplibregl.Map({
        container: "map",
        style: baseStyles.terrain,
        center: metroAreas.LA.coords,
        zoom: metroAreas.LA.zoom
    });

    map.on("load", async () => {
        addTransitLayers();
        await loadTransitStops();
        enableTransitPopups();
        restoreTransitVisibility();
    });

    bindUI();
    updateClearButtons();

    if (window.innerWidth <= 900) {
        toggleSidebar(true);
    }
}

init();