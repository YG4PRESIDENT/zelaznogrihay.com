import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createGlobe } from '../src/lib/voyages/globe.ts';
import { ATLAS_COLORS } from '../src/lib/voyages/rendering.ts';
import type { Destination } from '../src/lib/voyages/model.ts';

const geography = JSON.parse(await readFile(new URL('../public/data/voyages/countries.json', import.meta.url), 'utf8'));
const states = JSON.parse(await readFile(new URL('../public/data/voyages/states-us.json', import.meta.url), 'utf8'));
const us: Destination = { id: 'us', name: 'United States', kind: 'country', countryCodes: ['US'], focus: { lat: 39, lng: -98 },
    visited: true, order: 1, visits: [], plans: [], photos: [], html: '', states: [{ code: 'CA' }, { code: 'NY', stop: { lat: 40.71, lng: -74 }, stopLabel: 'New York airport' }] };
const japan: Destination = { ...us, id: 'jp', name: 'Japan', countryCodes: ['JP'], states: [], focus: { lat: 36, lng: 138 }, visited: false, plans: [{ title: 'Blossoms', thingsToDo: [], links: [] }] };

async function setup(reduced = false) {
    const dom = new JSDOM('<div id="map"></div>', { pretendToBeVisual: true });
    const { window } = dom;
    const container = window.document.getElementById('map')!;
    container.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 760, width: 1000, height: 760, toJSON() {} });
    const paints: unknown[] = [];
    const context = { fillStyle: '' as unknown, beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, closePath() {}, setTransform() {}, clearRect() {},
        save() {}, restore() {}, translate() {}, scale() {}, clip() {}, fillRect() {}, stroke() {},
        fill() { paints.push(this.fillStyle); }, createRadialGradient() { return { addColorStop() {} }; } };
    window.HTMLCanvasElement.prototype.getContext = (() => context) as any;
    let sequence = 0, time = 0;
    const frames = new Map<number, FrameRequestCallback>();
    const requests: string[] = [], motion: boolean[] = [];
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
    const globe = await createGlobe({ container, destinations: [us, japan], onSelect() {}, onCountry() {}, onCluster() {}, onCoordinates() {}, onMotionChange: value => motion.push(value) });
    function advance(count = 120) {
        for (let i = 0; i < count; i++) { time += 16; const current = [...frames.values()]; frames.clear(); for (const callback of current) callback(time); }
    }
    return { globe, container, requests, motion, paints, frames, advance, dom,
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
        assert.equal(env.container.querySelectorAll('.is-airport').length, 1);
        env.globe.select('us'); await Promise.resolve(); await Promise.resolve(); env.advance();
        assert.deepEqual(env.requests, ['/data/voyages/countries.json', '/data/voyages/states-us.json']);
        env.globe.select('us'); await Promise.resolve();
        assert.equal(env.requests.length, 2);
        assert.equal(env.motion.at(-1), false);
    } finally { env.dispose(); }
});

test('reduced motion stays still and keyboard rotation works without enabling an animation loop', async () => {
    const env = await setup(true);
    try {
        env.advance(); assert.equal(env.frames.size, 0); assert.equal(env.motion[0], false);
        env.globe.select('jp'); env.advance(); assert.equal(env.frames.size, 0);
        const before = env.paints.length;
        env.container.querySelector('canvas')!.dispatchEvent(new env.dom.window.KeyboardEvent('keydown', { key: 'ArrowRight' }));
        assert.ok(env.paints.length > before);
        env.advance(); assert.equal(env.frames.size, 0);
        assert.equal(env.globe.toggleMotion(), false);
    } finally { env.dispose(); }
});

test('rotation is pausable and destroying the globe cancels frames and observers', async () => {
    const env = await setup();
    try {
        env.advance(4); assert.ok(env.frames.size > 0);
        assert.equal(env.globe.toggleMotion(), false); env.advance(); assert.equal(env.frames.size, 0);
        assert.equal(env.globe.toggleMotion(), true); env.advance(4); assert.ok(env.frames.size > 0);
        env.globe.destroy(); assert.equal(env.frames.size, 0); assert.equal(env.container.children.length, 0); assert.equal(env.disconnected, 2);
    } finally { env.dispose(); }
});
