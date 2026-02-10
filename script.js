// Initialize map centered on San Francisco
const map = L.map('map').setView([37.7749, -122.4194], 13);

// Tile layers
const tileLayers = {
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri',
        maxZoom: 19
    }),
    terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap contributors',
        maxZoom: 17
    })
};

// Add default layer
tileLayers.street.addTo(map);
let currentLayer = 'street';

// Store route polylines and markers
let routePolylines = [];
let routeMarkers = [];

// Layer switching
document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const layer = this.dataset.layer;

        // Remove current layer
        map.removeLayer(tileLayers[currentLayer]);

        // Add new layer
        tileLayers[layer].addTo(map);
        currentLayer = layer;

        // Update button states
        document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
    });
});

// Sidebar toggle
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');

menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
});

// Search functionality
const searchBox = document.getElementById('searchBox');
const clearSearch = document.getElementById('clearSearch');

searchBox.addEventListener('input', function() {
    clearSearch.style.display = this.value ? 'block' : 'none';
});

clearSearch.addEventListener('click', () => {
    searchBox.value = '';
    clearSearch.style.display = 'none';
});

// Map controls
document.getElementById('zoomIn').addEventListener('click', () => {
    map.zoomIn();
});

document.getElementById('zoomOut').addEventListener('click', () => {
    map.zoomOut();
});

// My Location button — also fills the start input
document.getElementById('myLocation').addEventListener('click', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                map.setView([lat, lng], 15);
                L.marker([lat, lng]).addTo(map)
                    .bindPopup('You are here')
                    .openPopup();

                // Pre-fill start input with coordinates
                document.getElementById('startPoint').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            },
            () => {
                alert('Unable to retrieve your location');
            }
        );
    }
});

// Mode colors
const modeColors = {
    drive: '#4285f4',
    metro: '#ea4335',
    bart: '#ea4335',
    bus: '#34a853',
    walk: '#9aa0a6'
};

// Mode icons
const modeIcons = {
    drive: '🚗',
    metro: '🚇',
    bart: '🚇',
    bus: '🚌',
    walk: '🚶'
};

// Function to create route segment HTML
function createSegment(segment) {
    const icon = modeIcons[segment.mode] || '📍';
    const colorClass = segment.mode;

    return `
        <div class="segment ${colorClass}">
            <div class="segment-icon">${icon}</div>
            <div class="segment-info">
                <div class="segment-mode">${segment.modeName}</div>
                <div class="segment-details">${segment.details}</div>
            </div>
            <div class="segment-time">${segment.duration} min</div>
        </div>
        ${segment.transfer ? '<div class="transfer">Transfer point: ' + segment.transfer + '</div>' : ''}
    `;
}

// Function to create timeline segment
function createTimelineSegment(segment, totalDuration) {
    const color = modeColors[segment.mode] || '#9aa0a6';

    return `
        <div class="timeline-segment" style="flex: ${segment.duration}; background-color: ${color};" title="${segment.modeName}: ${segment.duration} min">
        </div>
    `;
}

// Function to display route on map
function displayRouteOnMap(route) {
    // Clear existing routes and markers
    routePolylines.forEach(polyline => map.removeLayer(polyline));
    routePolylines = [];
    routeMarkers.forEach(marker => map.removeLayer(marker));
    routeMarkers = [];

    // Draw each segment
    route.segments.forEach(segment => {
        if (segment.coordinates && segment.coordinates.length > 0) {
            const color = modeColors[segment.mode] || '#9aa0a6';
            const isDashed = segment.mode === 'walk';
            const polyline = L.polyline(segment.coordinates, {
                color: color,
                weight: 5,
                opacity: 0.8,
                dashArray: isDashed ? '8, 12' : null,
            }).addTo(map);

            routePolylines.push(polyline);
        }
    });

    // Fit map to route bounds
    if (routePolylines.length > 0) {
        const group = L.featureGroup(routePolylines);
        map.fitBounds(group.getBounds().pad(0.1));
    }

    // Add markers for start and end
    if (route.startCoords) {
        const startMarker = L.marker(route.startCoords).addTo(map)
            .bindPopup('Start: ' + route.startName);
        routeMarkers.push(startMarker);
    }
    if (route.endCoords) {
        const endMarker = L.marker(route.endCoords).addTo(map)
            .bindPopup('Destination: ' + route.endName);
        routeMarkers.push(endMarker);
    }

    // Show legend
    document.getElementById('routeLegend').style.display = 'block';
}

// Display route results
function displayRoute(routeData) {
    const { route, alternatives } = routeData;

    // Hide no route message
    document.getElementById('noRoute').style.display = 'none';

    // Show fastest route card
    const fastestCard = document.getElementById('fastestRoute');
    fastestCard.style.display = 'block';

    // Update total time
    document.getElementById('totalTime').textContent = route.totalDuration + ' min';

    // Update cost
    document.getElementById('routeCost').textContent = '💰 $' + route.totalCost.toFixed(2);

    // Create timeline
    const timeline = document.getElementById('routeTimeline');
    timeline.innerHTML = route.segments.map(seg =>
        createTimelineSegment(seg, route.totalDuration)
    ).join('');

    // Create segments
    const segmentsContainer = document.getElementById('routeSegments');
    segmentsContainer.innerHTML = route.segments.map(seg => createSegment(seg)).join('');

    // Display route on map
    displayRouteOnMap(route);

    // Show alternatives
    if (alternatives && alternatives.length > 0) {
        const alternativesSection = document.getElementById('alternatives');
        alternativesSection.style.display = 'block';

        const alternativesList = document.getElementById('alternativesList');
        alternativesList.innerHTML = alternatives.map(alt => `
            <div class="alternative-card">
                <div class="alternative-header">
                    <div class="alternative-modes">${alt.mode}</div>
                    <div class="alternative-time">
                        ${alt.duration} min
                        <span class="time-difference">${alt.difference}</span>
                    </div>
                </div>
                <div class="alternative-cost" style="font-size: 12px; color: #5f6368;">💰 $${alt.cost.toFixed(2)}</div>
            </div>
        `).join('');
    }
}

// Show loading state
function showLoading() {
    document.getElementById('noRoute').style.display = 'none';
    document.getElementById('fastestRoute').style.display = 'none';
    document.getElementById('alternatives').style.display = 'none';

    const results = document.getElementById('routeResults');
    let loader = document.getElementById('routeLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'routeLoader';
        loader.className = 'no-route';
        loader.innerHTML = `
            <div class="no-route-icon">⏳</div>
            <p>Finding the fastest route...</p>
        `;
        results.appendChild(loader);
    }
    loader.style.display = 'block';
}

// Hide loading state
function hideLoading() {
    const loader = document.getElementById('routeLoader');
    if (loader) loader.style.display = 'none';
}

// Show error
function showError(message) {
    hideLoading();
    document.getElementById('fastestRoute').style.display = 'none';
    document.getElementById('alternatives').style.display = 'none';

    const noRoute = document.getElementById('noRoute');
    noRoute.style.display = 'block';
    noRoute.innerHTML = `
        <div class="no-route-icon">⚠️</div>
        <p>${message}</p>
    `;
}

// Get Directions button
document.getElementById('getDirections').addEventListener('click', async () => {
    const startPoint = document.getElementById('startPoint').value.trim();
    const endPoint = document.getElementById('endPoint').value.trim();
    const departureTime = document.getElementById('departureTime').value;

    if (!startPoint || !endPoint) {
        alert('Please enter both starting point and destination');
        return;
    }

    showLoading();

    try {
        const response = await fetch('/api/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start: startPoint,
                end: endPoint,
                time: departureTime,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || 'Failed to find route');
            return;
        }

        hideLoading();
        displayRoute(data);
    } catch (err) {
        console.error('Route request failed:', err);
        showError('Could not connect to the routing server. Make sure the backend is running.');
    }
});

// Set default departure time to current time
function setDefaultTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('departureTime').value = `${hours}:${minutes}`;
}

setDefaultTime();
