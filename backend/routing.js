// Multimodal routing engine
// Combines driving (OSRM), BART, and walking into optimal routes

//const bart = require('./bart');
import bart from "./bart.js";
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OSRM_BASE = 'https://router.project-osrm.org';

// SF Bay Area bounding box for geocoding
const SF_VIEWBOX = '-122.6,37.4,-121.7,38.1';

const WALK_SPEED_KMH = 5;
const ROAD_FACTOR = 1.3; // straight-line to road distance multiplier

// Rate limit helper - simple sequential delay
let lastFetchTime = 0;
async function rateLimitedFetch(url, minDelayMs = 200) {
  const now = Date.now();
  const elapsed = now - lastFetchTime;
  if (elapsed < minDelayMs) {
    await new Promise(r => setTimeout(r, minDelayMs - elapsed));
  }
  lastFetchTime = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': 'FastRoute-SF/1.0 (journey planner prototype)' }
  });
  return res;
}

// Geocode a place name to coordinates using Nominatim
export async function geocode(query) {
  // Check if input looks like coordinates already
  const coordMatch = query.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    return { lat, lng, displayName: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
  }

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    viewbox: SF_VIEWBOX,
    bounded: '1',
  });

  const res = await rateLimitedFetch(`${NOMINATIM_BASE}/search?${params}`);
  const data = await res.json();

  if (!data || data.length === 0) {
    // Retry without bounding box in case the query is specific enough
    const params2 = new URLSearchParams({
      q: query + ', San Francisco Bay Area',
      format: 'json',
      limit: '1',
    });
    const res2 = await rateLimitedFetch(`${NOMINATIM_BASE}/search?${params2}`);
    const data2 = await res2.json();
    if (!data2 || data2.length === 0) {
      return null;
    }
    return {
      lat: parseFloat(data2[0].lat),
      lng: parseFloat(data2[0].lon),
      displayName: data2[0].display_name,
    };
  }

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}

// Get driving route from OSRM (returns geometry, duration, distance)
async function getOSRMRoute(startLat, startLng, endLat, endLng) {
  const url = `${OSRM_BASE}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

  try {
    const res = await rateLimitedFetch(url, 100);
    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
    const coordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    return {
      duration: Math.round(route.duration / 60), // seconds to minutes
      distance: Math.round(route.distance / 1000 * 10) / 10, // meters to km, 1 decimal
      coordinates,
    };
  } catch (err) {
    console.error('OSRM error:', err.message);
    return null;
  }
}

// Calculate walking time and straight-line path (no OSRM needed for short walks)
function getWalkingRoute(startLat, startLng, endLat, endLng) {
  const distKm = bart.haversineKm(startLat, startLng, endLat, endLng);
  const roadDistKm = distKm * ROAD_FACTOR;
  const durationMin = Math.round(roadDistKm / WALK_SPEED_KMH * 60);
  const distMiles = Math.round(roadDistKm * 0.621371 * 10) / 10;

  return {
    duration: Math.max(1, durationMin),
    distance: distMiles,
    coordinates: [[startLat, startLng], [endLat, endLng]],
  };
}

// Build a multimodal route option: drive/walk to BART, ride BART, walk to destination
async function buildMultimodalOption(startLat, startLng, endLat, endLng, originStation, destStation, accessMode) {
  // Get path to origin BART station
  let accessLeg;
  if (accessMode === 'drive') {
    accessLeg = await getOSRMRoute(startLat, startLng, originStation.lat, originStation.lng);
    if (!accessLeg) return null;
  } else {
    accessLeg = getWalkingRoute(startLat, startLng, originStation.lat, originStation.lng);
  }

  // Skip if access leg is too long
  if (accessMode === 'walk' && accessLeg.duration > 30) return null;
  if (accessMode === 'drive' && accessLeg.duration > 45) return null;

  // Get BART path
  const bartPath = bart.findPath(originStation.id, destStation.id);
  if (!bartPath) return null;

  // Walk from destination station to final destination
  const egressLeg = getWalkingRoute(destStation.lat, destStation.lng, endLat, endLng);

  // Skip if egress walk is too long
  if (egressLeg.duration > 30) return null;

  const bartFare = bart.calculateFare(bartPath);
  const driveCost = accessMode === 'drive' ? Math.round(accessLeg.distance * 0.5 * 100) / 100 : 0; // ~$0.50/km
  const totalCost = Math.round((bartFare + driveCost) * 100) / 100;
  const totalDuration = accessLeg.duration + bartPath.duration + egressLeg.duration;

  const segments = [];

  // Access segment (drive or walk to BART)
  if (accessLeg.duration > 0) {
    segments.push({
      mode: accessMode,
      modeName: accessMode === 'drive'
        ? `Drive to ${originStation.name}`
        : `Walk to ${originStation.name}`,
      details: accessMode === 'drive'
        ? `${accessLeg.distance} km to station`
        : `${accessLeg.distance} mi walk`,
      duration: accessLeg.duration,
      transfer: originStation.name,
      coordinates: accessLeg.coordinates,
    });
  }

  // BART segment
  const bartStart = bartPath.stationNames[0];
  const bartEnd = bartPath.stationNames[bartPath.stationNames.length - 1];
  segments.push({
    mode: 'bart',
    modeName: 'BART',
    details: `${bartStart} → ${bartEnd} (${bartPath.stations.length} stops)`,
    duration: bartPath.duration,
    transfer: destStation.name,
    coordinates: bartPath.coordinates,
  });

  // Egress segment (walk from BART to destination)
  if (egressLeg.duration > 0) {
    segments.push({
      mode: 'walk',
      modeName: 'Walk to destination',
      details: `${egressLeg.distance} mi`,
      duration: egressLeg.duration,
      coordinates: egressLeg.coordinates,
    });
  }

  return {
    totalDuration,
    totalCost,
    segments,
    description: accessMode === 'drive'
      ? `Drive + BART + Walk`
      : `Walk + BART + Walk`,
  };
}

// Main routing function: find the best multimodal routes
export async function findRoutes(startLat, startLng, endLat, endLng, startName, endName) {
  const options = [];

  // 1. Drive-only option
  const driveOnly = await getOSRMRoute(startLat, startLng, endLat, endLng);
  if (driveOnly) {
    const driveCost = Math.round(driveOnly.distance * 0.5 * 100) / 100;
    options.push({
      totalDuration: driveOnly.duration,
      totalCost: driveCost,
      description: 'Drive only',
      segments: [{
        mode: 'drive',
        modeName: 'Drive',
        details: `${driveOnly.distance} km via fastest route`,
        duration: driveOnly.duration,
        coordinates: driveOnly.coordinates,
      }],
    });
  }

  // 2. Walk-only option (only if under ~5 km)
  const walkDist = bart.haversineKm(startLat, startLng, endLat, endLng);
  if (walkDist < 5) {
    const walkOnly = getWalkingRoute(startLat, startLng, endLat, endLng);
    options.push({
      totalDuration: walkOnly.duration,
      totalCost: 0,
      description: 'Walk only',
      segments: [{
        mode: 'walk',
        modeName: 'Walk',
        details: `${walkOnly.distance} mi`,
        duration: walkOnly.duration,
        coordinates: walkOnly.coordinates,
      }],
    });
  }

  // 3. Multimodal options: Drive/Walk + BART + Walk
  const nearOrigin = bart.findNearestStations(startLat, startLng, 3);
  const nearDest = bart.findNearestStations(endLat, endLng, 3);

  // Try combinations of nearby stations with both drive and walk access
  const multimodalPromises = [];
  for (const orig of nearOrigin) {
    for (const dest of nearDest) {
      if (orig.id === dest.id) continue;
      multimodalPromises.push(
        buildMultimodalOption(startLat, startLng, endLat, endLng, orig, dest, 'drive')
      );
      multimodalPromises.push(
        buildMultimodalOption(startLat, startLng, endLat, endLng, orig, dest, 'walk')
      );
    }
  }

  const multimodalResults = await Promise.all(multimodalPromises);
  for (const result of multimodalResults) {
    if (result) options.push(result);
  }

  if (options.length === 0) {
    return null;
  }

  // Sort by total duration
  options.sort((a, b) => a.totalDuration - b.totalDuration);

  // Deduplicate similar options (keep fastest of each type)
  const seen = new Set();
  const uniqueOptions = [];
  for (const opt of options) {
    const key = opt.description;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueOptions.push(opt);
    }
  }

  // Best route
  const fastest = uniqueOptions[0];
  const route = {
    totalDuration: fastest.totalDuration,
    totalCost: fastest.totalCost,
    startName: startName,
    endName: endName,
    startCoords: [startLat, startLng],
    endCoords: [endLat, endLng],
    segments: fastest.segments,
  };

  // Alternatives (the rest)
  const alternatives = uniqueOptions.slice(1, 4).map(opt => ({
    mode: opt.description,
    duration: opt.totalDuration,
    difference: `+${opt.totalDuration - fastest.totalDuration} min`,
    cost: opt.totalCost,
  }));

  return { route, alternatives };
}

export default {findRoutes,geocode};
