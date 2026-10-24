import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { initVoyages } from '../src/lib/voyages/client.ts';
import { journalContent, escapeHtml } from '../src/lib/voyages/journal.ts';
import type { Destination } from '../src/lib/voyages/model.ts';

const html = await readFile(new URL('../dist/voyages/index.html', import.meta.url), 'utf8');
const countries = [{ code: 'JP', name: 'Japan', continent: 'Asia', center: { lat: 35, lng: 139 } }, { code: 'BR', name: 'Brazil', continent: 'South America', center: { lat: -15, lng: -48 } }];
const base: Destination = { id: 'test-harbor', name: 'Test harbor', kind: 'place', countryCodes: ['JP'], coordinates: { lat: 35, lng: 139 }, focus: { lat: 35, lng: 139 },
    visited: false, order: 1, visits: [{ id: 'first', date: '2024-04', memories: 'A memory from this test trip.' }],
    plans: [{ title: 'Return for the blossoms', thingsToDo: ['Walk along the harbor'], gettingThere: 'A train journey.', links: [] }],
    photos: [{ src: '/test-photo.webp', thumbnail: '/test-thumb.webp', alt: 'A test view', caption: 'Test caption', visit: 'first', cover: true, width: 800, height: 600 },
        { src: '/other-photo.webp', thumbnail: '/other-thumb.webp', alt: 'Another test view', cover: false, width: 800, height: 600 }], html: '<p>Notes from the journal.</p>' };
const second: Destination = { ...base, id: 'test-wish', name: 'Another place', countryCodes: ['BR'], coordinates: { lat: -15, lng: -48 }, focus: { lat: -15, lng: -48 }, visits: [], photos: [],
    plans: [{ title: 'A future expedition', thingsToDo: [], links: [] }] };

async function setup(options: { width?: number; url?: string; entries?: Destination[]; failGlobe?: boolean } = {}) {
    const payload = JSON.stringify({ countries, destinations: options.entries || [base, second] }).replace(/</g, '\\u003c');
    const documentHtml = html.replace(/(<script[^>]*id="voyages-data"[^>]*>)[\s\S]*?(<\/script>)/, (_match, start, end) => `${start}${payload}${end}`);
    const dom = new JSDOM(documentHtml, { url: options.url || 'http://localhost/voyages/', pretendToBeVisual: true });
    const { window } = dom;
    const descriptors = new Map<string, PropertyDescriptor | undefined>();
    const install = (key: string, value: unknown) => { descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); };
    for (const key of ['window', 'document', 'location', 'history', 'HTMLElement', 'Element', 'HTMLImageElement', 'MouseEvent', 'AbortController', 'Event', 'HTMLDialogElement']) install(key, window[key as keyof typeof window]);
    Object.defineProperty(window, 'innerWidth', { value: options.width || 1440, configurable: true });
    install('matchMedia', (query: string) => Object.assign(new window.EventTarget(), { matches: query.includes('min-width') && window.innerWidth >= 1024, media: query }));
    install('ResizeObserver', class { callback: () => void; constructor(callback: () => void) { this.callback = callback; } observe() { this.callback(); } disconnect() {} });
    install('requestAnimationFrame', window.requestAnimationFrame.bind(window));
    install('cancelAnimationFrame', window.cancelAnimationFrame.bind(window));
    install('CSS', { escape: (value: string) => value.replace(/["\\]/g, '\\$&') });
    window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
    const state = { shown: [] as string[], selected: null as string | null, destroyed: false, focused: null as {lat:number;lng:number}|null, callbacks: null as any, scrolls: 0 };
    window.HTMLElement.prototype.scrollIntoView = function () { state.scrolls++; };
    const document = window.document;
    document.getElementById('voyages-results')!.innerHTML = (options.entries || [base,second]).map(destination => '<details class="voyages-place" data-destination="'+escapeHtml(destination.id)+'"><summary>'+escapeHtml(destination.name)+'</summary><div class="voyages-inline-journal">'+journalContent(destination)+'</div></details>').join('');
    initVoyages(async () => {
        if (options.failGlobe) throw new Error('Deliberately unavailable WebGL');
        return { createGlobe: async callbacks => {
            state.callbacks = callbacks;
            return { select(id) { state.selected = id; }, show(ids) { state.shown = ids; }, focus(position) { state.focused = position; }, zoom() {}, toggleMotion() { return false; }, reset() {}, resize() {}, destroy() { state.destroyed = true; } };
        } };
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    const click = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        assert.ok(element, `Missing control: ${selector}`);
        element.click();
    };
    return { dom, document, window, state, click,
        dispose() {
            document.dispatchEvent(new window.Event('astro:before-swap'));
            dom.window.close();
            for (const [key, descriptor] of descriptors) {
                if (descriptor) Object.defineProperty(globalThis, key, descriptor);
                else delete (globalThis as Record<string, unknown>)[key];
            }
        },
    };
}


test('production page is a single list with the supplied history and no extra chrome', () => {
    const dom = new JSDOM(html); const document = dom.window.document;
    assert.equal(document.querySelector('.voyages-heading h1')!.textContent,'Voyages');
    assert.doesNotMatch(html,/A personal atlas|voyages-compass|data-filter=|data-view=|voyages-detail-panel|voyages-sheet-toggle/);
    assert.match(document.querySelector('.voyages-list-section h2')!.textContent!,/Where I've been\s*18 countries/);
    assert.equal(document.querySelector('aside.voyages-explorer'),null);
    assert.equal(document.getElementById('voyages-stage')!.nextElementSibling!.id,'voyages-explorer');
    const data=JSON.parse(document.getElementById('voyages-data')!.textContent!);
    assert.equal(data.destinations.filter(d=>d.visited).length,18);
    assert.equal(data.destinations.filter(d=>d.experience==='passed-through').length,3);
    assert.equal(data.destinations.find(d=>d.id==='china').experience,'lived');
    assert.equal(data.destinations.find(d=>d.id==='united-states').states.length,19);
    assert.equal(document.querySelectorAll('.voyages-key li').length,3);
    assert.equal(document.querySelectorAll('#destination-united-states [data-region-focus]').length,19);
    dom.window.close();
});

test('a linked region expands its country and keeps the globe in view on initial load',async()=>{
    const region={...base,id:'test-region',kind:'region' as const,coordinates:undefined};
    const env=await setup({entries:[base,region]});try{
        const parent=env.document.querySelector<HTMLDetailsElement>('[data-destination="test-harbor"]')!;
        const child=env.document.querySelector<HTMLDetailsElement>('[data-destination="test-region"]')!;
        parent.appendChild(child);
        env.state.callbacks.onSelect('test-region');
        assert.equal(parent.open,true);assert.equal(child.open,true);assert.equal(env.state.selected,'test-region');
    }finally{env.dispose();}
});

test('journals expand in place, keep other entries visible, and update the globe and URL',async()=>{
    const env=await setup();try{
        env.click('[data-destination="test-harbor"] summary');
        assert.equal(env.state.selected,'test-harbor');assert.equal(env.window.location.search,'?destination=test-harbor');
        assert.equal(env.document.getElementById('voyages-current')!.textContent,'Test harbor');
        assert.equal((env.document.querySelector('[data-destination="test-harbor"]') as HTMLDetailsElement).open,true);
        assert.match(env.document.querySelector('[data-destination="test-harbor"]')!.textContent!,/A memory from this test trip/);
        env.click('[data-destination="test-wish"] summary');
        assert.equal((env.document.querySelector('[data-destination="test-harbor"]') as HTMLDetailsElement).open,true);
        assert.equal((env.document.querySelector('[data-destination="test-wish"]') as HTMLDetailsElement).open,true);
        env.click('[data-destination="test-wish"] summary');assert.equal(env.window.location.search,'');
        env.state.callbacks.onCountry('JP');
        assert.equal(env.state.selected,'test-harbor');
        assert.equal(env.document.getElementById('voyages-current')!.textContent,'Test harbor');
        assert.equal(env.state.scrolls,0,'Selecting the globe should keep the current map view in place');
    }finally{env.dispose();}
});

test('direct links and browser history restore the inline selection',async()=>{
    const env=await setup({url:'http://localhost/voyages/?destination=test-wish'});try{
        assert.equal(env.state.selected,'test-wish');
        env.dom.reconfigure({url:'http://localhost/voyages/?destination=test-harbor'});env.window.dispatchEvent(new env.window.PopStateEvent('popstate'));
        assert.equal(env.state.selected,'test-harbor');
        env.dom.reconfigure({url:'http://localhost/voyages/'});env.window.dispatchEvent(new env.window.PopStateEvent('popstate'));
        assert.equal((env.document.querySelector('[data-destination="test-harbor"]') as HTMLDetailsElement).open,false);
    }finally{env.dispose();}
});

test('mobile uses the same inline list without replacing the browsing view',async()=>{
    const env=await setup({width:390});try{
        env.click('[data-destination="test-harbor"] summary');
        assert.equal(env.document.querySelectorAll('.voyages-place').length,2);
        assert.equal(env.document.querySelector('[data-destination="test-harbor"]')!.parentElement!.id,'voyages-results');
        assert.equal(env.document.getElementById('voyages-sheet-toggle'),null);
    }finally{env.dispose();}
});

test('airport stops focus their map dots directly from the state list',async()=>{
    const env=await setup({entries:[{...base,countryCodes:['US'],states:[{code:'NY',stop:{lat:40.71,lng:-74},stopLabel:'New York airport'}]}]});try{
        env.click('[data-destination="test-harbor"] summary');env.click('[data-state-stop="NY"]');
        assert.deepEqual(env.state.focused,{lat:40.71,lng:-74});
    }finally{env.dispose();}
});

test('gallery keeps photo navigation, visit captions, and missing-image handling',async()=>{
    const env=await setup();try{
        env.click('[data-destination="test-harbor"] summary');env.click('[data-photo="0"]');
        const dialog=env.document.getElementById('voyages-lightbox') as HTMLDialogElement;
        assert.equal(dialog.open,true);assert.match(env.document.getElementById('voyages-photo-caption')!.textContent!,/Test caption · Apr 2024/);
        dialog.dispatchEvent(new env.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(env.document.getElementById('voyages-photo-count')!.textContent,'2 / 2');
        env.document.getElementById('voyages-photo-image')!.dispatchEvent(new env.window.Event('error'));assert.equal(env.document.getElementById('voyages-photo-error')!.hidden,false);
        env.click('#voyages-photo-close');assert.equal(dialog.open,false);assert.equal(env.document.body.style.overflow,'');
    }finally{env.dispose();}
});

test('text is escaped and a failed globe leaves all inline journals available',async()=>{
    const original=console.error;console.error=()=>{};
    const env=await setup({failGlobe:true,entries:[{...base,summary:'<img src=x onerror=alert(1)>'}]});try{
        assert.match(env.document.getElementById('voyages-map-status')!.textContent!,/globe is unavailable/);
        env.click('[data-destination="test-harbor"] summary');assert.equal(env.document.querySelector('img[onerror]'),null);
        assert.match(env.document.querySelector('.voyages-inline-journal')!.textContent!,/<img src=x onerror=alert\(1\)>/);
        env.document.dispatchEvent(new env.window.Event('astro:before-swap'));
    }finally{env.dispose();console.error=original;}
});

test('navigation releases the renderer and unknown links leave the list available',async()=>{
    const env=await setup({url:'http://localhost/voyages/?destination=unknown'});try{
        assert.equal(env.document.querySelectorAll('.voyages-place').length,2);
        env.document.dispatchEvent(new env.window.Event('astro:before-swap'));assert.equal(env.state.destroyed,true);
    }finally{env.dispose();}
});
