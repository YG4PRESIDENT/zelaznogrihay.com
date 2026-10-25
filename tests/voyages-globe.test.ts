import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createGlobe } from '../src/lib/voyages/globe.ts';
import { ATLAS_COLORS, STATE_COLORS, globeProjection } from '../src/lib/voyages/rendering.ts';
import type { Destination, TravelRoute } from '../src/lib/voyages/model.ts';

const geography = JSON.parse(await readFile(new URL('../public/data/voyages/countries.json', import.meta.url), 'utf8'));
const states = JSON.parse(await readFile(new URL('../public/data/voyages/states-us.json', import.meta.url), 'utf8'));
const us: Destination = { id: 'us', name: 'United States', kind: 'country', countryCodes: ['US'], focus: { lat: 39, lng: -98 },
    visited: true, order: 1, visits: [], plans: [], photos: [], html: '', states: [{ code: 'CA' }, { code: 'NY', visited:false, stop: { lat: 40.71, lng: -74 }, stopLabel: 'New York airport' }] };
const japan: Destination = { ...us, id: 'jp', name: 'Japan', countryCodes: ['JP'], states: [], focus: { lat: 36, lng: 138 }, visited: false, plans: [{ title: 'Blossoms', thingsToDo: [], links: [] }] };

async function setup(reduced = false, options: { destinations?: Destination[]; routes?: TravelRoute[] } = {}) {
    const dom = new JSDOM('<div id="map"></div>', { pretendToBeVisual: true });
    const { window } = dom;
    const container = window.document.getElementById('map')!;
    container.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 760, width: 1000, height: 760, toJSON() {} });
    const paints: unknown[] = [];
    const dashes: number[][] = [], selections: string[] = [];
    const strokes: unknown[] = [];
    const context = { fillStyle: '' as unknown, strokeStyle: '' as unknown, beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, closePath() {}, setTransform() {}, clearRect() {},
        save() {}, restore() {}, translate() {}, scale() {}, clip() {}, fillRect() {}, stroke() { strokes.push(this.strokeStyle); }, setLineDash(value: number[]) { dashes.push(value); },
        fill() { paints.push(this.fillStyle); }, createRadialGradient() { return { addColorStop() {} }; } };
    window.HTMLCanvasElement.prototype.getContext = (() => context) as any;
    let sequence = 0, time = 0;
    const frames = new Map<number, FrameRequestCallback>();
    const requests: string[] = [];
    let disconnected = 0;
    const globals = {
        document: window.document, window, devicePixelRatio: 1, AbortController: window.AbortController,
        matchMedia: () => ({ matches: reduced, addEventListener() {} }),
        requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++sequence, callback); return sequence; },
        cancelAnimationFrame: (id: number) => frames.delete(id),
        ResizeObserver: class { observe() {} disconnect() { disconnected++; } },
        IntersectionObserver: class { observe() {} disconnect() { disconnected++; } },
        fetch: async (url: string) => { requests.push(url); return { ok: true, json: async () => url.includes('states-us') ? states : geography }; },
    };
    const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    const globe = await createGlobe({ container, destinations: options.destinations || [us, japan], routes: options.routes, onSelect(id) { selections.push(id); }, onCountry() {}, onCluster() {}, onCoordinates() {} });
    function advance(count = 120, milliseconds = 16) {
        for (let i = 0; i < count; i++) { time += milliseconds; const current = [...frames.values()]; frames.clear(); for (const callback of current) callback(time); }
    }
    return { globe, container, requests, paints, strokes, dashes, selections, frames, advance, dom,
        get disconnected() { return disconnected; },
        dispose() { globe.destroy(); dom.window.close(); for (const [key, original] of originals) { if (original) Object.defineProperty(globalThis, key, original); else delete (globalThis as any)[key]; } },
    };
}

test('globe draws immediately with three status colors and loads states only on demand', async () => {
    const env = await setup();
    try {
        assert.equal(env.container.dataset.ready, 'true');
        assert.deepEqual(env.requests, ['/data/voyages/countries.json']);
        for (const color of [ATLAS_COLORS.visited, ATLAS_COLORS.wanted, ATLAS_COLORS.unvisited]) assert.ok(env.paints.includes(color));
        assert.equal(env.container.querySelectorAll('.is-airport').length, 0);
        env.globe.select('us'); await Promise.resolve(); await Promise.resolve(); env.advance();
        assert.deepEqual(env.requests, ['/data/voyages/countries.json', '/data/voyages/states-us.json']);
        env.globe.select('us'); await Promise.resolve();
        assert.equal(env.requests.length, 2);
        assert.ok(env.paints.includes(STATE_COLORS.visited));
        assert.ok(env.paints.includes(STATE_COLORS.other));
        env.advance(); assert.equal(env.frames.size, 0);
    } finally { env.dispose(); }
});

test('reduced motion stays still and keyboard rotation works without enabling an animation loop', async () => {
    const env = await setup(true);
    try {
        env.advance(); assert.equal(env.frames.size, 0);
        env.globe.select('jp'); env.advance(); assert.equal(env.frames.size, 0);
        const before = env.paints.length;
        env.container.querySelector('canvas')!.dispatchEvent(new env.dom.window.KeyboardEvent('keydown', { key: 'ArrowRight' }));
        assert.ok(env.paints.length > before);
        env.advance(); assert.equal(env.frames.size, 0);
    } finally { env.dispose(); }
});

test('the opening turn settles without a control and destruction cancels frames and observers', async () => {
    const env = await setup();
    try {
        env.advance(4); assert.ok(env.frames.size > 0);
        env.advance(40, 100); assert.equal(env.frames.size, 0, 'Opening motion must finish within four seconds even at 10fps');
        env.globe.zoom(1); env.advance(4); assert.ok(env.frames.size > 0);
        env.globe.destroy(); assert.equal(env.frames.size, 0); assert.equal(env.container.children.length, 0); assert.equal(env.disconnected, 2);
    } finally { env.dispose(); }
});


test('route links stay light, quiet city dots are selectable on touch, and labels appear on selection', async () => {
    const chennai: Destination = { ...us, id:'chennai', name:'Chennai', kind:'place', countryCodes:['IN'], states:[], coordinates:{lat:13.0919,lng:80.2781}, focus:{lat:13.0919,lng:80.2781} };
    const hyderabad: Destination = { ...chennai, id:'hyderabad', name:'Hyderabad', coordinates:{lat:17.3999,lng:78.48}, focus:{lat:17.3999,lng:78.48} };
    const route: TravelRoute = { id:'test-route', name:'Test route', stops:[{destinationId:chennai.id,position:chennai.coordinates!},{destinationId:hyderabad.id,position:hyderabad.coordinates!}], approximateLegs:[0] };
    const env = await setup(true, { destinations:[chennai,hyderabad], routes:[route] });
    try {
        assert.ok(env.dashes.every(dash => dash.length===0),'Routes should never be dashed');
        assert.equal(env.strokes.filter(color=>color==='#d2edb68c').length,1,'Each route should be one continuous stroke');
        const marker=env.container.querySelector<HTMLDivElement>('.voyage-marker')!;
        assert.equal(marker.hidden,true,'Unselected cities should not show label buttons');
        const canvas=env.container.querySelector('canvas')!;
        canvas.setPointerCapture=()=>{}; canvas.hasPointerCapture=()=>false; canvas.releasePointerCapture=()=>{};
        const point=globeProjection(1000,760,80,22)([chennai.coordinates!.lng,chennai.coordinates!.lat])!;
        for(const type of ['pointerdown','pointerup']){
            const event=new env.dom.window.Event(type);
            Object.assign(event,{pointerId:1,pointerType:'touch',button:0,clientX:point[0]+16,clientY:point[1]});
            canvas.dispatchEvent(event);
        }
        assert.equal(env.selections.at(-1),'chennai','Touch can select a small dot within a comfortable target');
        env.globe.select('chennai'); env.advance();
        assert.equal(marker.hidden,false); assert.ok(marker.classList.contains('is-selected'));
    }finally{env.dispose();}
});
