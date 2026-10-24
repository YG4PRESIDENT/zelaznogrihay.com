import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mapshaper from 'mapshaper';
import { geoArea } from 'd3-geo';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
async function load(filename, local) {
    if (local) return JSON.parse(await readFile(local, 'utf8'));
    const response = await fetch(base + filename);
    if (!response.ok) throw new Error(`Natural Earth returned ${response.status}`);
    return response.json();
}
const raw = await load('ne_50m_admin_0_countries.geojson', process.argv[2]);
const features = raw.features.map(feature => {
    const p = feature.properties;
    // Accept an already reduced copy as an offline input, too.
    const code = p.code || (/^[A-Z]{2}$/.test(p.ISO_A2_EH) ? p.ISO_A2_EH : /^[A-Z]{2}$/.test(p.ISO_A2) ? p.ISO_A2 : p.ADM0_A3);
    return { type: 'Feature', properties: p.code ? p : {
        code, name: p.ADMIN, continent: p.CONTINENT, center: { lat: p.LABEL_Y, lng: p.LABEL_X },
    }, geometry: feature.geometry };
});
async function simplify(features, percentage) {
    const files = await mapshaper.applyCommands(`-i input.json -simplify ${percentage}% keep-shapes -o output.json format=geojson precision=0.001`, {
        'input.json': JSON.stringify({ type: 'FeatureCollection', features }),
    });
    const result = JSON.parse(String(files['output.json']));
    // D3's spherical paths use clockwise exterior rings for the smaller area.
    for (const feature of result.features) {
        const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        for (const coordinates of polygons) if (geoArea({ type: 'Polygon', coordinates }) > 2 * Math.PI) {
            for (const ring of coordinates) ring.reverse();
        }
    }
    return JSON.stringify(result);
}
const destination = path.join(root, 'public/data/voyages');
await mkdir(destination, { recursive: true });
await writeFile(path.join(destination, 'countries.json'), await simplify(features, 7));
await writeFile(path.join(root, 'src/data/voyages-countries.json'), `${JSON.stringify(features.map(feature => feature.properties), null, 2)}\n`);

const rawStates = await load('ne_50m_admin_1_states_provinces.geojson', process.argv[3]);
const states = rawStates.features.filter(feature => feature.properties.admin === 'United States of America' && feature.properties.postal !== 'DC').map(feature => ({
    type: 'Feature', properties: { code: feature.properties.postal, name: feature.properties.name,
        center: { lat: feature.properties.latitude, lng: feature.properties.longitude } }, geometry: feature.geometry,
}));
await writeFile(path.join(destination, 'states-us.json'), await simplify(states, 12));
await writeFile(path.join(root, 'src/data/voyages-us-states.json'), `${JSON.stringify(states.map(feature => feature.properties), null, 2)}\n`);
console.log(`Saved ${features.length} simplified countries and ${states.length} US states. State geometry loads only when the US is selected.`);
