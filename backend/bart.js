// BART station data and pathfinding for the San Francisco Bay Area

const stations = {
  // San Francisco
  embarcadero:        { name: 'Embarcadero',             lat: 37.7929, lng: -122.3969 },
  montgomery:         { name: 'Montgomery St',           lat: 37.7894, lng: -122.4013 },
  powell:             { name: 'Powell St',               lat: 37.7844, lng: -122.4079 },
  civic_center:       { name: 'Civic Center/UN Plaza',   lat: 37.7796, lng: -122.4138 },
  sixteenth_st:       { name: '16th St Mission',         lat: 37.7650, lng: -122.4195 },
  twentyfourth_st:    { name: '24th St Mission',         lat: 37.7522, lng: -122.4184 },
  glen_park:          { name: 'Glen Park',               lat: 37.7329, lng: -122.4345 },
  balboa_park:        { name: 'Balboa Park',             lat: 37.7210, lng: -122.4474 },

  // Peninsula
  daly_city:          { name: 'Daly City',               lat: 37.7063, lng: -122.4692 },
  colma:              { name: 'Colma',                   lat: 37.6846, lng: -122.4669 },
  south_sf:           { name: 'South San Francisco',     lat: 37.6644, lng: -122.4440 },
  san_bruno:          { name: 'San Bruno',               lat: 37.6374, lng: -122.4160 },
  sfo:                { name: 'SFO Airport',             lat: 37.6159, lng: -122.3925 },
  millbrae:           { name: 'Millbrae',                lat: 37.5997, lng: -122.3858 },

  // Oakland
  west_oakland:       { name: 'West Oakland',            lat: 37.8046, lng: -122.2945 },
  twelfth_st:         { name: '12th St/Oakland City Center', lat: 37.8032, lng: -122.2717 },
  nineteenth_st:      { name: '19th St/Oakland',         lat: 37.8088, lng: -122.2689 },
  macarthur:          { name: 'MacArthur',               lat: 37.8284, lng: -122.2671 },
  lake_merritt:       { name: 'Lake Merritt',            lat: 37.7973, lng: -122.2651 },
  fruitvale:          { name: 'Fruitvale',               lat: 37.7748, lng: -122.2241 },
  coliseum:           { name: 'Coliseum',                lat: 37.7536, lng: -122.1968 },

  // Berkeley / Richmond
  ashby:              { name: 'Ashby',                   lat: 37.8529, lng: -122.2700 },
  downtown_berkeley:  { name: 'Downtown Berkeley',       lat: 37.8698, lng: -122.2682 },
  north_berkeley:     { name: 'North Berkeley',          lat: 37.8739, lng: -122.2834 },
  el_cerrito_plaza:   { name: 'El Cerrito Plaza',        lat: 37.9028, lng: -122.2990 },
  el_cerrito_del_norte: { name: 'El Cerrito del Norte',  lat: 37.9254, lng: -122.3174 },
  richmond:           { name: 'Richmond',                lat: 37.9368, lng: -122.3535 },

  // Fremont / South East Bay
  san_leandro:        { name: 'San Leandro',             lat: 37.7217, lng: -122.1609 },
  bay_fair:           { name: 'Bay Fair',                 lat: 37.6972, lng: -122.1266 },
  castro_valley:      { name: 'Castro Valley',           lat: 37.6907, lng: -122.0754 },
  hayward:            { name: 'Hayward',                 lat: 37.6700, lng: -122.0871 },
  south_hayward:      { name: 'South Hayward',           lat: 37.6348, lng: -122.0571 },
  union_city:         { name: 'Union City',              lat: 37.5907, lng: -122.0170 },
  fremont:            { name: 'Fremont',                 lat: 37.5574, lng: -121.9764 },
  warm_springs:       { name: 'Warm Springs/South Fremont', lat: 37.5024, lng: -121.9396 },
  milpitas:           { name: 'Milpitas',                lat: 37.4102, lng: -121.8914 },
  berryessa:          { name: 'Berryessa/North San Jose', lat: 37.3685, lng: -121.8750 },

  // Contra Costa
  rockridge:          { name: 'Rockridge',               lat: 37.8443, lng: -122.2514 },
  orinda:             { name: 'Orinda',                  lat: 37.8784, lng: -122.1835 },
  lafayette:          { name: 'Lafayette',               lat: 37.8932, lng: -122.1247 },
  walnut_creek:       { name: 'Walnut Creek',            lat: 37.9057, lng: -122.0673 },
  pleasant_hill:      { name: 'Pleasant Hill/Contra Costa Centre', lat: 37.9283, lng: -122.0560 },
  concord:            { name: 'Concord',                 lat: 37.9739, lng: -122.0294 },
  north_concord:      { name: 'North Concord/Martinez',  lat: 37.9564, lng: -122.0247 },
  pittsburg_bay_point: { name: 'Pittsburg/Bay Point',    lat: 37.9964, lng: -121.9454 },
  pittsburg_center:   { name: 'Pittsburg Center',        lat: 37.9989, lng: -121.9392 },
  antioch:            { name: 'Antioch',                 lat: 37.9953, lng: -121.7834 },

  // Dublin / Pleasanton
  west_dublin:        { name: 'West Dublin/Pleasanton',  lat: 37.6997, lng: -121.9284 },
  dublin_pleasanton:  { name: 'Dublin/Pleasanton',       lat: 37.7017, lng: -121.8990 },
};

// Adjacency list: [stationA, stationB, travelTimeMinutes]
// These are bidirectional connections
const connections = [
  // SF trunk (Embarcadero → Daly City)
  ['embarcadero', 'montgomery', 2],
  ['montgomery', 'powell', 2],
  ['powell', 'civic_center', 2],
  ['civic_center', 'sixteenth_st', 3],
  ['sixteenth_st', 'twentyfourth_st', 3],
  ['twentyfourth_st', 'glen_park', 3],
  ['glen_park', 'balboa_park', 3],
  ['balboa_park', 'daly_city', 4],

  // Peninsula (Daly City → Millbrae)
  ['daly_city', 'colma', 4],
  ['colma', 'south_sf', 3],
  ['south_sf', 'san_bruno', 3],
  ['san_bruno', 'sfo', 4],
  ['sfo', 'millbrae', 4],
  ['san_bruno', 'millbrae', 4],

  // Transbay tube
  ['embarcadero', 'west_oakland', 7],

  // Oakland (West Oakland → MacArthur via downtown)
  ['west_oakland', 'twelfth_st', 5],
  ['twelfth_st', 'nineteenth_st', 2],
  ['nineteenth_st', 'macarthur', 3],

  // Oakland south (12th St → Coliseum via Lake Merritt)
  ['twelfth_st', 'lake_merritt', 3],
  ['lake_merritt', 'fruitvale', 4],
  ['fruitvale', 'coliseum', 4],

  // South county (Coliseum → Bay Fair → south)
  ['coliseum', 'san_leandro', 4],
  ['san_leandro', 'bay_fair', 3],

  // Bay Fair → Dublin/Pleasanton branch
  ['bay_fair', 'castro_valley', 5],
  ['castro_valley', 'west_dublin', 6],
  ['west_dublin', 'dublin_pleasanton', 3],

  // Bay Fair → Fremont/Berryessa branch
  ['bay_fair', 'hayward', 4],
  ['hayward', 'south_hayward', 4],
  ['south_hayward', 'union_city', 5],
  ['union_city', 'fremont', 5],
  ['fremont', 'warm_springs', 5],
  ['warm_springs', 'milpitas', 7],
  ['milpitas', 'berryessa', 5],

  // Richmond line (MacArthur → Richmond)
  ['macarthur', 'ashby', 3],
  ['ashby', 'downtown_berkeley', 3],
  ['downtown_berkeley', 'north_berkeley', 2],
  ['north_berkeley', 'el_cerrito_plaza', 3],
  ['el_cerrito_plaza', 'el_cerrito_del_norte', 3],
  ['el_cerrito_del_norte', 'richmond', 4],

  // Contra Costa line (MacArthur → Antioch)
  ['macarthur', 'rockridge', 3],
  ['rockridge', 'orinda', 5],
  ['orinda', 'lafayette', 4],
  ['lafayette', 'walnut_creek', 5],
  ['walnut_creek', 'pleasant_hill', 3],
  ['pleasant_hill', 'concord', 4],
  ['concord', 'north_concord', 3],
  ['north_concord', 'pittsburg_bay_point', 5],
  ['pittsburg_bay_point', 'pittsburg_center', 3],
  ['pittsburg_center', 'antioch', 8],
];

// Build adjacency map for Dijkstra
const graph = {};
for (const id of Object.keys(stations)) {
  graph[id] = [];
}
for (const [a, b, time] of connections) {
  graph[a].push({ station: b, time });
  graph[b].push({ station: a, time });
}

// Dijkstra's shortest path
function findPath(fromId, toId) {
  const dist = {};
  const prev = {};
  const visited = new Set();

  for (const id of Object.keys(stations)) {
    dist[id] = Infinity;
  }
  dist[fromId] = 0;

  while (true) {
    // Find unvisited node with smallest distance
    let current = null;
    let minDist = Infinity;
    for (const id of Object.keys(stations)) {
      if (!visited.has(id) && dist[id] < minDist) {
        minDist = dist[id];
        current = id;
      }
    }

    if (current === null || current === toId) break;
    visited.add(current);

    for (const { station: neighbor, time } of graph[current]) {
      if (visited.has(neighbor)) continue;
      const newDist = dist[current] + time;
      if (newDist < dist[neighbor]) {
        dist[neighbor] = newDist;
        prev[neighbor] = current;
      }
    }
  }

  if (dist[toId] === Infinity) return null;

  // Reconstruct path
  const path = [];
  let current = toId;
  while (current) {
    path.unshift(current);
    current = prev[current];
  }

  return {
    stations: path,
    duration: dist[toId],
    coordinates: path.map(id => [stations[id].lat, stations[id].lng]),
    stationNames: path.map(id => stations[id].name),
  };
}

// Haversine distance in km
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Find N nearest stations to given coordinates
function findNearestStations(lat, lng, n = 3) {
  const distances = Object.entries(stations).map(([id, s]) => ({
    id,
    ...s,
    distance: haversineKm(lat, lng, s.lat, s.lng),
  }));

  distances.sort((a, b) => a.distance - b.distance);
  return distances.slice(0, n);
}

// Calculate approximate BART fare
// Based on distance: $2.10 base + ~$0.20 per station + $1.50 transbay surcharge
function calculateFare(path) {
  if (!path) return 0;
  const stationCount = path.stations.length;
  let fare = 2.10 + (stationCount - 1) * 0.20;

  // Check if route crosses the bay (goes through West Oakland ↔ Embarcadero)
  const crossesBay = path.stations.includes('west_oakland') &&
    path.stations.includes('embarcadero');
  if (crossesBay) fare += 1.50;

  return Math.round(fare * 100) / 100;
}
export default {stations, findPath, findNearestStations,calculateFare, haversineKm };