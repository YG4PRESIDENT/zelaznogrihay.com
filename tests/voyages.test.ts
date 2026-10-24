import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import matter from 'gray-matter';
import { z } from 'astro/zod';
import { createDestinationSchema } from '../src/lib/voyages/schema.ts';
import { clusterPoints, destinationUrl, formatTravelDate, getCountryStatus, getStats, getTimeline, isTravelDate, matchesFilter, matchesSearch, type Destination } from '../src/lib/voyages/model.ts';

const schema = createDestinationSchema(z.string());
const destination = (overrides: Partial<Destination> = {}): Destination => ({
    id: 'test-place', name: 'Test place', kind: 'place', countryCodes: ['JP'], coordinates: { lat: 35, lng: 139 },
    visited: false, order: 100, visits: [], plans: [], photos: [], html: '', ...overrides,
});

test('one country is counted once across repeat visits and several places', () => {
    const places = [destination({ visits: [{ id: 'first' }, { id: 'return' }] }), destination({ id: 'second-place', visited: true }), destination({ id: 'another-country', countryCodes: ['BR'], visited: true })];
    assert.deepEqual(getStats(places), { countries: 2, places: 3, wishes: 0 });
});

test('a visited country needs no invented city or date', () => {
    const country = destination({ kind: 'country', coordinates: undefined, visited: true });
    assert.equal(schema.safeParse(country).success, true);
    assert.deepEqual(getStats([country]), { countries: 1, places: 0, wishes: 0 });
    assert.equal(getTimeline([country]).visits[0].label, 'Date not recorded');
});

test('past visits and future plans can coexist without double counting', () => {
    const place = destination({ visits: [{ id: 'first', date: '2024' }], plans: [{ title: 'Return', thingsToDo: [], links: [] }] });
    assert.equal(matchesFilter(place, 'been'), true);
    assert.equal(matchesFilter(place, 'wanted'), true);
    assert.equal(getCountryStatus([place], 'JP').visited, true);
    assert.equal(getCountryStatus([place], 'JP').wanted, true);
    assert.equal(getStats([place]).wishes, 1);
});

test('Antarctica and unvisited aspirations do not inflate visited-country counts', () => {
    assert.equal(getStats([destination({ kind: 'region', countryCodes: ['AQ'], visited: true }), destination()]).countries, 0);
});

test('partial dates retain their real precision and calendar dates are validated', () => {
    for (const date of ['2024', '2024-02', '2024-02-29', '2026-10-24']) assert.equal(isTravelDate(date), true, date);
    for (const date of ['2023-02-29', '2024-02-30', '2024-13', '2024-00', '2024-01-00', '2024-1-2', 'spring']) assert.equal(isTravelDate(date), false, date);
    assert.equal(formatTravelDate('2024'), '2024');
    assert.equal(formatTravelDate('2024-02'), 'Feb 2024');
    assert.equal(formatTravelDate('2024-02-29'), 'Feb 29, 2024');
});

test('timeline sorts past visits newest first, future plans oldest first, and leaves wishes undated', () => {
    const entry = destination({ visits: [{ id: 'old', date: '2020' }, { id: 'unknown' }, { id: 'new', date: '2025-05' }], plans: [
        { title: 'Later', date: '2028', thingsToDo: [], links: [] },
        { title: 'Someday', timeframe: 'When the time is right', thingsToDo: [], links: [] },
        { title: 'Sooner', date: '2027-02', thingsToDo: [], links: [] },
    ] });
    const timeline = getTimeline([entry]);
    assert.deepEqual(timeline.visits.map(item => item.date), ['2025-05', '2020', undefined]);
    assert.deepEqual(timeline.upcoming.map(item => item.title), ['Sooner', 'Later']);
    assert.equal(timeline.someday[0].date, undefined);
    assert.equal(timeline.someday[0].label, 'When the time is right');
});

test('search includes country names and wishlist text', () => {
    const entry = destination({ plans: [{ title: 'Cherry blossoms with family', thingsToDo: [], links: [] }] });
    const countries = [{ code: 'JP', name: 'Japan', continent: 'Asia', center: { lat: 35, lng: 139 } }];
    assert.equal(matchesSearch(entry, '  JAPAN ', countries), true);
    assert.equal(matchesSearch(entry, 'blossoms', countries), true);
    assert.equal(matchesSearch(entry, 'absent', countries), false);
});

test('schema separates exact pins from broad regions and unplaced wishes', () => {
    assert.equal(schema.safeParse({ name: 'City', kind: 'place', countryCodes: ['JP'] }).success, false);
    assert.equal(schema.safeParse({ name: 'Region', kind: 'region', coordinates: { lat: 1, lng: 2 } }).success, false);
    assert.equal(schema.safeParse({ name: 'Region', kind: 'region', focus: { lat: 1, lng: 2 } }).success, true);
    assert.equal(schema.safeParse({ name: 'Wish', kind: 'idea', focus: { lat: 1, lng: 2 } }).success, false);
    assert.equal(schema.safeParse({ name: 'Wish', kind: 'idea' }).success, true);
    assert.equal(schema.safeParse({ name: 'City', kind: 'place', countryCodes: ['JP'], coordinates: { lat: 91, lng: 2 } }).success, false);
});

test('schema validates visit IDs, chronology, photo captions, and safe links', () => {
    const base = { name: 'Country', kind: 'country', countryCodes: ['JP'] };
    assert.equal(schema.safeParse({ ...base, visits: [{ id: 'trip' }, { id: 'trip' }] }).success, false);
    assert.equal(schema.safeParse({ ...base, visits: [{ id: 'trip', date: '2025', endDate: '2024' }] }).success, false);
    assert.equal(schema.safeParse({ ...base, visits: [{ id: 'trip', date: '2023-02-29' }] }).success, false);
    assert.equal(schema.safeParse({ ...base, photos: [{ src: 'photo.jpg', alt: ' ' }] }).success, false);
    assert.equal(schema.safeParse({ ...base, photos: [{ src: 'photo.jpg', alt: 'A view', visit: 'unknown' }] }).success, false);
    assert.equal(schema.safeParse({ ...base, plans: [{ title: 'Trip', links: [{ label: 'Unsafe', url: 'javascript:alert(1)' }] }] }).success, false);
    assert.equal(schema.safeParse({ ...base, visits: [{ id: 'trip' }], photos: [{ src: 'photo.jpg', alt: 'A view', visit: 'trip' }] }).success, true);
});

test('nearby marker groups retain stable representatives and distant markers remain separate', () => {
    const groups = clusterPoints([{ id: 'selected', x: 10, y: 10 }, { id: 'near', x: 20, y: 20 }, { id: 'far', x: 200, y: 200 }]);
    assert.deepEqual(groups.map(group => group.map(point => point.id)), [['selected', 'near'], ['far']]);
    assert.deepEqual(clusterPoints([]), []);
});

test('visit ranges accept mixed date precision without requiring invented days', () => {
    const base = { name: 'Country', kind: 'country', countryCodes: ['JP'] };
    assert.equal(schema.safeParse({ ...base, visits: [{ id: 'trip', date: '2025-04-12', endDate: '2025' }] }).success, true);
    assert.equal(schema.safeParse({ ...base, visits: [{ id: 'trip', date: '2024-02-29', endDate: '2024-02' }] }).success, true);
    assert.equal(schema.safeParse({ ...base, visits: [{ id: 'trip', date: '2025-04-12', endDate: '2025-03' }] }).success, false);
});

test('destination links encode identifiers', () => {
    assert.equal(destinationUrl('country/place'), '/voyages/?destination=country%2Fplace');
});

test('published wishes migrate without adding visited places, photos, or dates', async () => {
    const ids = ['africa', 'turkey', 'japan', 'needle-tap-tattoo', 'brazil', 'antarctica', 'patagonia'];
    let wishes = 0;
    for (const id of ids) {
        const raw = matter(await readFile(new URL(`../src/content/voyages/${id}/index.md`, import.meta.url), 'utf8'));
        const data = schema.parse(raw.data);
        wishes += data.plans.length;
        assert.equal(data.visited, false);
        assert.equal(data.visits.length, 0);
        assert.equal(data.photos.length, 0);
        assert.equal(data.coordinates, undefined);
        for (const plan of data.plans) assert.equal(plan.date, undefined);
    }
    assert.equal(wishes, 8);
});

test('travel history preserves the supplied stop and residency classifications', async () => {
    const names = ['mexico','united-states','peru','costa-rica','france','egypt','israel','jordan','uae','india','nepal','china','laos','thailand','vietnam','malaysia','singapore','south-korea'];
    const entries = [];
    for (const id of names) entries.push(schema.parse(matter(await readFile(new URL(`../src/content/voyages/${id}/index.md`,import.meta.url),'utf8')).data));
    assert.equal(entries.length,18);
    assert.equal(entries.filter(entry=>entry.experience==='passed-through').length,3);
    assert.equal(entries.find(entry=>entry.name==='China')!.experience,'lived');
    const states=entries.find(entry=>entry.countryCodes.includes('US'))!.states;
    assert.equal(states.length,19);assert.equal(new Set(states.map(state=>state.code)).size,19);
    assert.ok(states.find(state=>state.code==='NY')!.stop);assert.ok(states.find(state=>state.code==='OH')!.stop);
});

test('US polygon faces remain well above the ocean between their vertices', async () => {
    const {GLOBE_RENDERING}=await import('../src/lib/voyages/rendering.ts');
    const {Triangle,Vector3}=await import('three');
    const original=(globalThis as any).window;
    (globalThis as any).window={};
    const {default:Geometry}=await import('three-conic-polygon-geometry');
    if(original===undefined)delete (globalThis as any).window;else (globalThis as any).window=original;
    const geography=JSON.parse(await readFile(new URL('../public/data/voyages/countries.json',import.meta.url),'utf8'));
    const us=geography.features.find(feature=>feature.properties.code==='US');
    let minimum=Infinity;
    for(const polygon of us.geometry.coordinates){
        const geometry=new Geometry(polygon,0,100,false,true,false,GLOBE_RENDERING.countryCurvature);
        const positions=geometry.attributes.position,index=geometry.index!;
        const a=new Vector3(),b=new Vector3(),c=new Vector3(),near=new Vector3(),origin=new Vector3(),triangle=new Triangle();
        for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(positions,index.getX(i));b.fromBufferAttribute(positions,index.getX(i+1));c.fromBufferAttribute(positions,index.getX(i+2));triangle.set(a,b,c).closestPointToPoint(origin,near);minimum=Math.min(minimum,near.length()*(1+GLOBE_RENDERING.countryAltitude));}
        geometry.dispose();
    }
    assert.ok(minimum>100.5,`Country cap must clear the ocean, got ${minimum}`);
});
