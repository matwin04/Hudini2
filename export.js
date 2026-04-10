#!/usr/bin/env node

/**
 * GTFS to GeoJSON Exporter using gtfs-to-geojson
 *
 * This script uses the gtfs-to-geojson package to convert GTFS feeds
 * into GeoJSON files for use with the file-based FastRoute server.
 *
 * Usage:
 *   node export-geojson.js
 */

import gtfsToGeoJSON from 'gtfs-to-geojson';
import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the SoCal config
const configPath = path.join(__dirname, 'public', 'data', 'socal.json');
const socalConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));

const OUTPUT_BASE = path.join(__dirname, 'public', 'data', 'geojson');

console.log('🚀 Starting GTFS to GeoJSON export using gtfs-to-geojson...\n');
console.log(`Output directory: ${OUTPUT_BASE}\n`);
console.log(`Processing ${socalConfig.agencies.length} agencies\n`);

// Ensure output directory exists
await fs.mkdir(OUTPUT_BASE, { recursive: true });

// Process each agency
for (const agency of socalConfig.agencies) {
    const { agencyKey, url } = agency;

    try {
        console.log(`📍 Processing ${agencyKey}...`);

        // Create config for this specific agency
        const config = {
            agencies: [
                {
                    agencyKey,
                    url
                }
            ],
            outputType: 'agency',
            skipImport: false
        };

        // Run gtfs-to-geojson
        console.log(`  - Downloading and converting GTFS data...`);
        await gtfsToGeoJSON(config);

        // gtfs-to-geojson creates files in ./geojson/:agencyKey/
        // We need to move them to our output directory
        const sourceDir = path.join(process.cwd(), 'geojson', agencyKey);
        const targetDir = path.join(OUTPUT_BASE, agencyKey);

        // Create target directory
        await fs.mkdir(targetDir, { recursive: true });

        // Move the files
        const files = await fs.readdir(sourceDir);

        for (const file of files) {
            if (file.endsWith('.geojson')) {
                const sourcePath = path.join(sourceDir, file);
                const targetPath = path.join(targetDir, file);

                // Read and rewrite to ensure proper formatting
                const data = await fs.readFile(sourcePath, 'utf8');
                const geojson = JSON.parse(data);
                await fs.writeFile(targetPath, JSON.stringify(geojson, null, 2));

                console.log(`    ✓ Moved ${file} (${geojson.features?.length || 0} features)`);
            }
        }

        // Clean up source directory
        await fs.rm(sourceDir, { recursive: true, force: true });

        console.log(`  ✅ ${agencyKey} export complete\n`);

    } catch (err) {
        console.error(`  ❌ Error exporting ${agencyKey}:`, err.message);
        console.log('  Continuing with next agency...\n');
    }
}

// Clean up the temporary geojson directory
try {
    await fs.rm(path.join(process.cwd(), 'geojson'), { recursive: true, force: true });
    console.log('🧹 Cleaned up temporary files\n');
} catch (err) {
    // Ignore if doesn't exist
}

console.log('🎉 All exports complete!');
console.log(`\nGeoJSON files are ready in: ${OUTPUT_BASE}`);

// Summary
console.log('\n📊 Export Summary:');
try {
    const agencies = await fs.readdir(OUTPUT_BASE);
    console.log(`   Agencies exported: ${agencies.length}`);

    let totalFiles = 0;
    let totalFeatures = 0;

    for (const agency of agencies) {
        const agencyPath = path.join(OUTPUT_BASE, agency);
        const agencyStat = await fs.stat(agencyPath);

        if (!agencyStat.isDirectory()) continue;

        const files = await fs.readdir(agencyPath);
        const geojsonFiles = files.filter(f => f.endsWith('.geojson'));
        totalFiles += geojsonFiles.length;

        for (const file of geojsonFiles) {
            try {
                const filePath = path.join(agencyPath, file);
                const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
                totalFeatures += data.features?.length || 0;
            } catch (err) {
                // Skip if error reading file
            }
        }
    }

    console.log(`   Total GeoJSON files: ${totalFiles}`);
    console.log(`   Total features: ${totalFeatures}`);

} catch (err) {
    console.warn('   Could not generate summary:', err.message);
}

console.log('\n✨ Ready to run: node server.js');