const express = require('express');
const path = require('path');
const { geocode, findRoutes } = require('./routing');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Geocode endpoint - convert place name to coordinates
app.get('/api/geocode', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Missing query parameter "q"' });
  }

  try {
    const result = await geocode(q);
    if (!result) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(result);
  } catch (err) {
    console.error('Geocode error:', err);
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

// Route endpoint - find multimodal routes
app.post('/api/route', async (req, res) => {
  const { start, end, time } = req.body;

  if (!start || !end) {
    return res.status(400).json({ error: 'Missing start or end location' });
  }

  try {
    // Geocode start and end locations
    console.log(`Finding route: "${start}" → "${end}" at ${time || 'now'}`);

    const startGeo = await geocode(start);
    if (!startGeo) {
      return res.status(404).json({ error: `Could not find location: "${start}"` });
    }

    const endGeo = await geocode(end);
    if (!endGeo) {
      return res.status(404).json({ error: `Could not find location: "${end}"` });
    }

    console.log(`  Start: ${startGeo.displayName} (${startGeo.lat}, ${startGeo.lng})`);
    console.log(`  End: ${endGeo.displayName} (${endGeo.lat}, ${endGeo.lng})`);

    // Find multimodal routes
    const routes = await findRoutes(
      startGeo.lat, startGeo.lng,
      endGeo.lat, endGeo.lng,
      startGeo.displayName,
      endGeo.displayName
    );

    if (!routes) {
      return res.status(404).json({ error: 'No routes found between these locations' });
    }

    console.log(`  Found route: ${routes.route.totalDuration} min, $${routes.route.totalCost}`);
    res.json(routes);
  } catch (err) {
    console.error('Routing error:', err);
    res.status(500).json({ error: 'Route calculation failed' });
  }
});

app.listen(PORT, () => {
  console.log(`FastRoute server running at http://localhost:${PORT}`);
  console.log(`Open the app in your browser to start planning routes.`);
});
