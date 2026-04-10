// ==============================
// GLOBAL STATE
// ==============================

let map;
let originMarker;
let destinationMarker;
let clickPopup = null;

let itineraryLayers = [];
let selectedItineraryIndex = null;
let transferSourceId = "transfer-points";

// ==============================
// MAP INIT
// ==============================


function initMap() {
    map = new maplibregl.Map({
        container: "map",
        style: {
            version: 8,
            sources: {
                carto: {
                    type: "raster",
                    tiles: [
                        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
                        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
                        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
                    ],
                    tileSize: 256
                }
            },
            layers: [
                {
                    id: "carto-layer",
                    type: "raster",
                    source: "carto"
                }
            ]
        },
        center: [-118.2437, 34.0522],
        zoom: 11
    });
    map.addControl(new maplibregl.NavigationControl());
    let stopsTimeout;

    map.on("load", () => {
        initLocation();
        enableTransitPopups();
        addTransitLayers();
        addTransitStopsLayer();
    });
}
function enableTransitPopups() {
    map.on("mouseenter", "all-stops", () => {
        map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "all-stopss", () => {
        map.getCanvas().style.cursor = "";
    });
    map.on("click", "all-stops", (e) => {
        const f = e.features[0];
        const coords = f.geometry.coordinates;
        const props = f.properties;

        const popup = new maplibregl.Popup();

        const wrapper = document.createElement("div");

        wrapper.innerHTML = `
        <b>${props.name || props.stop_name || "Stop"}</b><br/>
        ${props.id || props.stop_id || ""}<br/>
    `;

        const originBtn = document.createElement("button");
        originBtn.textContent = "Set As Origin";

        originBtn.addEventListener("click", () => {
            const [lng, lat] = coords;
            setOriginMarker(lng, lat);
            popup.remove();
        });

        const destBtn = document.createElement("button");
        destBtn.textContent = "Set As Destination";

        destBtn.addEventListener("click", () => {
            const [lng, lat] = coords;
            setDestinationMarker(lng, lat);
            popup.remove();
        });

        wrapper.appendChild(originBtn);
        wrapper.appendChild(destBtn);

        popup.setLngLat(coords).setDOMContent(wrapper).addTo(map);
    });

}


// ==============================
// LOCATION
// ==============================

function initLocation() {
    if (!navigator.geolocation) return fallbackLocation();

    navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        map.flyTo({ center: [lng, lat], zoom: 13 });

        // default origin = current location
        setOriginMarker(lng, lat);

        // default destination nearby so planTrip can still work immediately
        setDestinationMarker(lng + 0.02, lat + 0.02);

        enableMapClickSelector();
    }, fallbackLocation);
}

function fallbackLocation() {
    const lat = 34.0522;
    const lng = -118.2437;

    map.setCenter([lng, lat]);
    setOriginMarker(lng, lat);
    setDestinationMarker(lng + 0.02, lat + 0.02);
    enableMapClickSelector();
}

// ==============================
// MARKERS
// ==============================

function setOriginMarker(lng, lat) {
    if (originMarker) originMarker.remove();

    originMarker = new maplibregl.Marker({
        color: "#16a34a",
        draggable: false
    })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 20 }).setHTML("<strong>Origin</strong>"))
        .addTo(map);
}

function setDestinationMarker(lng, lat) {
    if (destinationMarker) destinationMarker.remove();

    destinationMarker = new maplibregl.Marker({
        color: "#dc2626",
        draggable: false
    })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 20 }).setHTML("<strong>Destination</strong>"))
        .addTo(map);
}

// ==============================
// CLICK SELECTOR
// ==============================

function enableMapClickSelector() {
    map.on("click", (e) => {
        // 🔥 check if click hit a stop feature
        const features = map.queryRenderedFeatures(e.point, {
            layers: ["all-stops", "nearby-stops-layer"] // add any stop layers here
        });

        // if clicking a station → do nothing (let station popup handle it)
        if (features.length > 0) return;

        const lng = e.lngLat.lng;
        const lat = e.lngLat.lat;

        showPointChooser(lng, lat);
    });
}
async function loadApiStops() {
    const bounds = map.getBounds();

    const min = `${bounds.getSouth()},${bounds.getWest()}`;
    const max = `${bounds.getNorth()},${bounds.getEast()}`;

    try {
        const res = await fetch(`/api/stops?min=${min}&max=${max}`);
        const geojson = await res.json();

        if (map.getSource("api-stops")) {
            map.getSource("api-stops").setData(geojson);
            return;
        }

        map.addSource("api-stops", {
            type: "geojson",
            data: geojson
        });

        map.addLayer({
            id: "all-stops",
            type: "circle",
            source: "api-stops",
            paint: {
                "circle-radius": 5,
                "circle-color": "#0072BC",
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1
            }
        });

    } catch (err) {
        console.error("API stops failed:", err);
    }
}
function showPointChooser(lng, lat) {
    if (clickPopup) {
        clickPopup.remove();
    }

    const wrapper = document.createElement("div");
    wrapper.className = "point-chooser";

    const title = document.createElement("div");
    title.className = "point-chooser-title";
    title.textContent = "Use this point as:";
    wrapper.appendChild(title);

    const buttons = document.createElement("div");
    buttons.className = "point-chooser-buttons";

    const originBtn = document.createElement("button");
    originBtn.type = "button";
    originBtn.className = "chooser-btn chooser-origin";
    originBtn.textContent = "Origin";
    originBtn.addEventListener("click", () => {
        setOriginMarker(lng, lat);
        if (clickPopup) clickPopup.remove();
    });

    const destBtn = document.createElement("button");
    destBtn.type = "button";
    destBtn.className = "chooser-btn chooser-destination";
    destBtn.textContent = "Destination";
    destBtn.addEventListener("click", () => {
        setDestinationMarker(lng, lat);
        if (clickPopup) clickPopup.remove();
    });

    buttons.appendChild(originBtn);
    buttons.appendChild(destBtn);
    wrapper.appendChild(buttons);

    clickPopup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        offset: 16
    })
        .setLngLat([lng, lat])
        .setDOMContent(wrapper)
        .addTo(map);
}

// ==============================
// HELPERS
// ==============================

function formatTime(iso) {
    return new Date(iso).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
}

function minutes(seconds) {
    return Math.round(seconds / 60);
}

function decodePolyline(str, precision = 5) {
    let index = 0,
        lat = 0,
        lng = 0,
        coordinates = [];
    const factor = Math.pow(10, precision);

    while (index < str.length) {
        let result = 0,
            shift = 0,
            b;

        do {
            b = str.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += deltaLat;

        result = 0;
        shift = 0;

        do {
            b = str.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += deltaLng;

        coordinates.push([lng / factor, lat / factor]);
    }

    return coordinates;
}

function getModeIcon(mode) {
    const iconMap = {
        REGIONAL_FAST_RAIL: "mdi-train",
        REGIONAL_RAIL: "mdi-train",
        BUS: "mdi-bus",
        WALK: "mdi-walk",
        TRAM: "mdi-tram",
        SUBWAY: "mdi-subway",
        BICYCLE: "mdi-bike"
    };

    return iconMap[mode] || "mdi-map-marker-path";
}

function getLegColor(leg) {
    return leg.routeColor ? `#${leg.routeColor}` : "#2563eb";
}

function escapeHtml(text) {
    return String(text ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

// ==============================
// ROUTE ANIMATION
// ==============================

function animateLine(layerId) {
    let opacity = 0;
    const interval = setInterval(() => {
        opacity += 0.08;
        if (opacity >= 0.35) {
            opacity = 0.35;
            clearInterval(interval);
        }

        if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, "line-opacity", opacity);
        } else {
            clearInterval(interval);
        }
    }, 30);
}

// ==============================
// CLEAR ROUTES
// ==============================

function clearRoutes() {
    itineraryLayers.forEach((group) => {
        group.layers.forEach((id) => {
            if (map.getLayer(id)) map.removeLayer(id);
            if (map.getSource(id)) map.removeSource(id);
        });
    });

    if (map.getLayer("transfer-layer")) map.removeLayer("transfer-layer");
    if (map.getSource(transferSourceId)) map.removeSource(transferSourceId);

    itineraryLayers = [];
}

// ==============================
// RENDER ROUTES
// ==============================

function renderAllItinerariesOnMap(itineraries) {
    clearRoutes();

    itineraries.forEach((itinerary, i) => {
        const group = { index: i, layers: [] };

        itinerary.legs.forEach((leg, j) => {
            const encoded = leg.legGeometry?.points;
            if (!encoded) return;

            const coords = decodePolyline(encoded, leg.legGeometry?.precision ?? 5);

            const sourceId = `route-${i}-${j}`;
            const casingId = `route-casing-${i}-${j}`;
            const layerId = `route-line-${i}-${j}`;

            map.addSource(sourceId, {
                type: "geojson",
                data: {
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: coords
                    }
                }
            });

            map.addLayer({
                id: casingId,
                type: "line",
                source: sourceId,
                paint: {
                    "line-color": "#ffffff",
                    "line-width": 8,
                    "line-opacity": 0.35
                }
            });

            map.addLayer({
                id: layerId,
                type: "line",
                source: sourceId,
                paint: {
                    "line-color": getLegColor(leg),
                    "line-width": 5,
                    "line-opacity": 0,
                    "line-dasharray": leg.mode === "WALK" ? [2, 2] : [1, 0]
                }
            });

            animateLine(layerId);
            group.layers.push(casingId, layerId, sourceId);
        });

        itineraryLayers.push(group);
    });
}

// ==============================
// HIGHLIGHT
// ==============================

function highlightItinerary(index, itineraries) {
    selectedItineraryIndex = index;
    const bounds = new maplibregl.LngLatBounds();
    const transferPoints = [];

    if (map.getLayer("transfer-layer")) map.removeLayer("transfer-layer");
    if (map.getSource(transferSourceId)) map.removeSource(transferSourceId);

    itineraryLayers.forEach((group, i) => {
        const itinerary = itineraries[i];

        itinerary.legs.forEach((leg, j) => {
            const lineId = `route-line-${i}-${j}`;
            const casingId = `route-casing-${i}-${j}`;

            if (!map.getLayer(lineId) || !map.getLayer(casingId)) return;

            if (i === index) {
                map.setPaintProperty(lineId, "line-opacity", 1);
                map.setPaintProperty(lineId, "line-width", 6);
                map.setPaintProperty(casingId, "line-opacity", 0.9);
                map.setPaintProperty(casingId, "line-width", 9);

                const coords = decodePolyline(leg.legGeometry?.points, leg.legGeometry?.precision ?? 5);

                coords.forEach((c) => bounds.extend(c));

                if (j > 0 && leg.from?.lon != null && leg.from?.lat != null) {
                    transferPoints.push({
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: [leg.from.lon, leg.from.lat]
                        },
                        properties: {
                            name: leg.from.name || "Transfer"
                        }
                    });
                }
            } else {
                map.setPaintProperty(lineId, "line-opacity", 0.18);
                map.setPaintProperty(lineId, "line-width", 4);
                map.setPaintProperty(casingId, "line-opacity", 0.15);
                map.setPaintProperty(casingId, "line-width", 7);
            }
        });
    });

    if (transferPoints.length) {
        map.addSource(transferSourceId, {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: transferPoints
            }
        });

        map.addLayer({
            id: "transfer-layer",
            type: "circle",
            source: transferSourceId,
            paint: {
                "circle-radius": 6,
                "circle-color": "#111111",
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2
            }
        });
    }

    if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
            padding: 80,
            duration: 600
        });
    }
}

// ==============================
// DETAIL HTML
// ==============================

function buildLegDetails(itinerary) {
    const container = document.createElement("div");

    itinerary.legs.forEach((leg) => {
        const iconClass = getModeIcon(leg.mode);
        const routeColor = getLegColor(leg);
        const agencyLogo = getAgencyLogo(leg.agencyId);

        const wrapper = document.createElement("div");
        wrapper.className = "detail-leg";

        // ======================
        // ICON
        // ======================
        const icon = document.createElement("span");
        icon.className = `mdi ${iconClass}`;
        icon.style.color = routeColor;

        // ======================
        // MAIN
        // ======================
        const main = document.createElement("div");
        main.className = "detail-leg-main";

        // ======================
        // TOP ROW (route + time)
        // ======================
        const top = document.createElement("div");
        top.className = "detail-leg-top";

        const title = document.createElement("span");
        title.className = "detail-route";

        if (leg.routeShortName) {
            title.textContent = `${leg.routeShortName} ${leg.routeLongName || ""}`.trim();
        } else {
            title.textContent = leg.mode;
        }

        const time = document.createElement("span");
        time.className = "detail-time";

        const start = leg.startTime ? formatTime(leg.startTime) : "";
        const end = leg.endTime ? formatTime(leg.endTime) : "";
        time.textContent = start + (end ? ` — ${end}` : "");

        top.appendChild(title);
        top.appendChild(time);

        // ======================
        // HEADSIGN (THIS IS NEW 🔥)
        // ======================
        if (leg.headsign) {
            const headsign = document.createElement("div");
            headsign.className = "detail-headsign";
            headsign.innerHTML = `${leg.routeShortName} For <b>${leg.headsign}</b>`;
            main.appendChild(headsign);
        }
        // ======================
        // FROM → TO
        // ======================
        const sub = document.createElement("div");

        sub.className = "detail-leg-sub";

        const from = leg.from?.name || "";
        const to = leg.to?.name || "";
        const duration = leg.duration ? `${minutes(leg.duration)} min` : "";

        sub.innerHTML = `<b>${from}</b> to <b>${to}</b>${duration ? ` • ${duration}` : ""}`;

        // ======================
        // AGENCY ROW (NEW 🔥)
        // ======================
        const agencyRow = document.createElement("div");
        agencyRow.className = "detail-agency";

        if (agencyLogo) {
            const img = document.createElement("img");
            img.src = agencyLogo;
            img.className = "agency-logo";
            agencyRow.appendChild(img);
        }

        if (leg.agencyName) {
            const agencyText = document.createElement("span");
            agencyText.textContent = leg.agencyName;
            agencyRow.appendChild(agencyText);
        }
        const stopCount = leg.intermediateStops?.length || 0;

        if (stopCount > 0) {
            const stopsSummary = document.createElement("div");
            stopsSummary.className = "detail-stops-summary";
            stopsSummary.textContent = `${stopCount} stops`;

            main.appendChild(stopsSummary);
        }
        if (stopCount > 0) {
            const toggleBtn = document.createElement("button");
            toggleBtn.className = "stops-toggle";
            toggleBtn.textContent = "Show stops";

            const stopsList = document.createElement("div");
            stopsList.className = "stops-list";

            leg.intermediateStops.forEach((stop) => {
                const item = document.createElement("div");
                item.className = "stop-item";

                const name = document.createElement("span");
                name.textContent = stop.name;

                const time = document.createElement("span");
                time.className = "stop-time";
                time.textContent = stop.arrival ? formatTime(stop.arrival) : "";

                item.appendChild(name);
                item.appendChild(time);
                stopsList.appendChild(item);
            });

            toggleBtn.addEventListener("click", () => {
                const isOpen = stopsList.classList.toggle("open");
                toggleBtn.textContent = isOpen ? "Hide stops" : "Show stops";
            });

            main.appendChild(toggleBtn);
            main.appendChild(stopsList);
        }
        // ======================
        // ASSEMBLE
        // ======================
        main.appendChild(top);
        main.appendChild(sub);
        main.appendChild(agencyRow);

        wrapper.appendChild(icon);
        wrapper.appendChild(main);

        container.appendChild(wrapper);
    });

    return container;
}
function getAgencyLogo(agencyId) {
    if (!agencyId) return null;
    return `/public/icons/agency_logos/${agencyId}.png`;
}
// ==============================
// CARD RENDERING
// ==============================

function renderItineraries(data) {
    const container = document.getElementById("itineraries");
    container.innerHTML = "";

    if (!data?.itineraries?.length) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="mdi mdi-alert-circle-outline"></span>
                <p>No trip results found.</p>
            </div>
        `;
        clearRoutes();
        return;
    }

    renderAllItinerariesOnMap(data.itineraries);

    data.itineraries.forEach((itinerary, index) => {
        const card = document.createElement("div");
        card.className = "itinerary-card";

        const fare =
            itinerary.fare?.fare?.cents != null
                ? `$${(itinerary.fare.fare.cents / 100).toFixed(2)}`
                : "Fare unavailable";

        const previewIcons = itinerary.legs
            .map((leg) => {
                const iconClass = getModeIcon(leg.mode);
                const routeColor = getLegColor(leg);

                if (leg.routeShortName) {
                    return `
                    <span class="preview-icon">
                        <span class="mdi ${iconClass}" style="color:${routeColor}"></span>
                        <span class="mini-pill" style="background:${routeColor}">
                            ${escapeHtml(leg.routeShortName)}
                        </span>
                    </span>
                `;
                }

                return `<span class="mdi ${iconClass}" style="color:${routeColor}"></span>`;
            })
            .join(`<span class="preview-arrow">›</span>`);

        card.innerHTML = `
            <div class="summary-row">
                <div>${formatTime(itinerary.startTime)} — ${formatTime(itinerary.endTime)}</div>
                <div>${minutes(itinerary.duration)} min</div>
            </div>
            <div class="preview-row">${previewIcons}</div>
            <div class="fare">${fare}</div>
            <button class="details-btn" type="button">Details</button>
            <button class="save-btn" type="button">Save Trip</button>
            <div class="details-content"></div>
          `;

        // ✅ THIS WAS MISSING
        const detailsContainer = card.querySelector(".details-content");
        const detailsElement = buildLegDetails(itinerary);
        detailsContainer.appendChild(detailsElement);
        card.addEventListener("click", () => {
            document.querySelectorAll(".itinerary-card").forEach((c) => c.classList.remove("active"));

            card.classList.add("active");
            highlightItinerary(index, data.itineraries);
        });

        card.querySelector(".details-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            card.classList.toggle("expanded");
        });

        container.appendChild(card);
    });

    const firstCard = container.querySelector(".itinerary-card");
    if (firstCard) {
        firstCard.classList.add("active");
        highlightItinerary(0, data.itineraries);
    }
}

// ==============================
// PLAN
// ==============================

async function planTrip() {
    if (!originMarker || !destinationMarker) return;

    const origin = originMarker.getLngLat();
    const dest = destinationMarker.getLngLat();

    const params = new URLSearchParams({
        time: new Date().toISOString(),
        fromPlace: `${origin.lat},${origin.lng}`,
        toPlace: `${dest.lat},${dest.lng}`,
        withFares: "true"
    });

    try {
        const res = await fetch(`/api/directions?${params.toString()}`);

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        renderItineraries(data);
    } catch (err) {
        console.error("Plan trip failed:", err);

        const container = document.getElementById("itineraries");
        container.innerHTML = `
            <div class="empty-state">
                <span class="mdi mdi-alert"></span>
                <p>Trip planning failed. Check console.</p>
            </div>
        `;
    }
}

// ==============================
// INIT
// ==============================

function saveTrip() {
    console.log("SAVING TRIP");
}
function addTransitStopsLayer() {
    if (map.getSource("transit-stops")) return;

    map.addSource("transit-stops", {
        type: "vector",
        tiles: [
            "https://transit.land/api/v2/tiles/stops/tiles/{z}/{x}/{y}.pbf?apikey=WOo9vL8ECMWN76EcKjsNGfo8YgNZ7c2u"
        ],
        minzoom: 0,
        maxzoom: 14
    });

    // =========================
    // ALL STOPS (default)
    // =========================
    map.addLayer({
        id: "all-stops",
        type: "circle",
        source: "transit-stops",
        "source-layer": "stops",
        paint: {
            "circle-radius": 3,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#111111",
            "circle-stroke-width": 1
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
        id: "bus-lines",
        type: "line",
        source: "transit-routes",
        "source-layer": "routes",
        filter: ["==", ["get", "route_type"], 3],
        paint: {
            "line-color": ["get", "route_color"],
            "line-width": 1,
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

function addShapesLayer() {
    // avoid duplicate loads
    if (map.getSource("shapes")) return;

    map.addSource("shapes", {
        type: "geojson",
        data: "/api/stops"
    });

    // white casing (like your routes)
    map.addLayer({
        id: "shapes-casing",
        type: "line",
        source: "shapes",
        paint: {
            "line-color": "#ffffff",
            "line-width": 6,
            "line-opacity": 0.7
        }
    });

    // main colored line
    map.addLayer({
        id: "shapes-line",
        type: "line",
        source: "shapes",
        paint: {
            "line-color": ["get", "route_color"],
            "line-width": 3,
            "line-opacity": 0.9
        }
    });
}
document.addEventListener("DOMContentLoaded", () => {
    initMap();
   // document.getElementById("saveBtn").addEventListener("click", saveTrip);
    document.getElementById("planBtn").addEventListener("click", planTrip);
});
