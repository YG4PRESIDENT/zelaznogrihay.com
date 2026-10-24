import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
let raw;
if (process.argv[2]) raw = JSON.parse(await readFile(process.argv[2], 'utf8'));
else {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Natural Earth returned ${response.status}`);
    raw = await response.json();
}

const round = value => Array.isArray(value) ? value.map(round) : Math.round(value * 1000) / 1000;
const features = raw.features.map(feature => {
    const p = feature.properties;
    const code = /^[A-Z]{2}$/.test(p.ISO_A2_EH) ? p.ISO_A2_EH : /^[A-Z]{2}$/.test(p.ISO_A2) ? p.ISO_A2 : p.ADM0_A3;
    return { type: 'Feature', properties: {
        code, name: p.ADMIN, continent: p.CONTINENT,
        center: { lat: p.LABEL_Y, lng: p.LABEL_X },
    }, geometry: { type: feature.geometry.type, coordinates: round(feature.geometry.coordinates) } };
});
const destination = path.join(root, 'public/data/voyages');
await mkdir(destination, { recursive: true });
await writeFile(path.join(destination, 'countries.json'), JSON.stringify({ type: 'FeatureCollection', features }));
await writeFile(path.join(root, 'src/data/voyages-countries.json'), `${JSON.stringify(features.map(feature => feature.properties), null, 2)}\n`);
console.log(`Saved ${features.length} Natural Earth country outlines and their browsing index.`);
