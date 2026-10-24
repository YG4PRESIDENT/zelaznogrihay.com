import { geoContains, geoDistance, geoGraticule10, geoPath, type GeoProjection } from 'd3-geo';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { clusterPoints, hasBeen, type Country, type Destination, type Coordinates, type TravelRoute } from './model.ts';
import { ATLAS_COLORS, countryFill, globePoint, globeProjection, shortestLongitude, wrapLongitude } from './rendering.ts';

type CountryFeature = Feature<Polygon | MultiPolygon, Country>;
type StateFeature = Feature<Polygon | MultiPolygon, { code: string; name: string; center: Coordinates }>;
type Marker = { id: string; destination: Destination; position: Coordinates; element: HTMLDivElement; airport?: boolean };
interface GlobeOptions {
    container: HTMLElement;
    destinations: Destination[];
    routes?: TravelRoute[];
    onSelect: (id: string) => void;
    onCountry: (code: string) => void;
    onCluster: (ids: string[]) => void;
    onCoordinates: (coordinates: Coordinates) => void;
}
export interface AtlasGlobe {
    select: (id: string | null) => void;
    focus: (position: Coordinates) => void;
    show: (ids: string[]) => void;
    zoom: (direction: number) => void;
    reset: () => void;
    resize: (detailOpen?: boolean) => void;
    destroy: () => void;
}
const cameraIcon = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M3 5.5h3l1.5-2h5l1.5 2h3v11H3z"/><circle cx="10" cy="10.5" r="3"/></svg>';

/** A spherical Canvas atlas: no WebGL startup, polygon meshes, or depth fighting. */
export async function createGlobe(options: GlobeOptions): Promise<AtlasGlobe> {
    const { container, destinations } = options;
    const routes = options.routes || [];
    const visitedPlaces = destinations.filter(destination => destination.kind === 'place' && hasBeen(destination) && destination.coordinates);
    const abort = new AbortController();
    const { signal } = abort;
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Travel globe. Drag or use arrow keys to rotate. Use plus and minus to zoom. All places are also in the list.');
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas is unavailable');
    const ctx = context;
    const response = await fetch('/data/voyages/countries.json', { signal });
    if (!response.ok) throw new Error(`Country outlines returned ${response.status}`);
    const geography = await response.json() as FeatureCollection<Polygon | MultiPolygon, Country>;
    const colors = new Map(geography.features.map(feature => [feature.properties.code, countryFill(destinations, feature.properties.code)]));
    const countryIds = new Set(destinations.flatMap(destination => destination.countryCodes));
    const graticule = geoGraticule10();
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const markers: Marker[] = [];
    let visible = new Set(destinations.map(destination => destination.id));
    let selected: string | null = null;
    let states: StateFeature[] | null = null;
    let statesLoading = false;
    let disposed = false;
    let inView = true;
    let openingRemaining = reduceMotion.matches ? 0 : 3.5;
    let frame = 0;
    let lastTime = 0;
    let lastPaint = 0;
    let width = 0, height = 0;
    let projection: GeoProjection;
    const camera = { lat: 22, lng: 80, zoom: 1 };
    const velocity = { lat: 0, lng: 0, zoom: 0 };
    let target: typeof camera | null = null;
    let dragging: { id: number; x: number; y: number; startX: number; startY: number; time: number; moved: boolean } | null = null;
    const tooltip = document.createElement('div');
    tooltip.className = 'voyages-tooltip'; tooltip.hidden = true;
    container.append(canvas, tooltip);

    function schedule() { if (!frame && !disposed && inView && !document.hidden) frame = requestAnimationFrame(animate); }
    function stop() {
        target = null; velocity.lat = velocity.lng = velocity.zoom = 0;
        openingRemaining = 0; tooltip.hidden = true; schedule();
    }
    function go(position: Coordinates, zoom = 1.18) {
        openingRemaining = 0;
        const next = { lat: Math.max(-80, Math.min(80, position.lat)), lng: shortestLongitude(camera.lng, position.lng), zoom };
        if (reduceMotion.matches) { Object.assign(camera, next); target = null; draw(); }
        else { target = next; schedule(); }
    }
    async function loadStates() {
        if (states || statesLoading) return;
        statesLoading = true;
        try {
            const response = await fetch('/data/voyages/states-us.json', { signal });
            if (!response.ok) throw new Error(`State outlines returned ${response.status}`);
            states = (await response.json() as FeatureCollection<Polygon | MultiPolygon, StateFeature['properties']>).features;
            schedule();
        } catch (error) { if (!disposed) console.warn('State outlines could not be loaded.', error); }
        finally { statesLoading = false; }
    }
    function activeUS() { return destinations.find(destination => destination.id === selected && destination.countryCodes.includes('US') && destination.states?.length); }
    function draw() {
        if (!width || !height || disposed) return;
        projection = globeProjection(width, height, camera.lng, camera.lat, camera.zoom);
        const path = geoPath(projection, ctx);
        const [cx, cy] = projection.translate(), radius = projection.scale();
        ctx.clearRect(0, 0, width, height);
        // A soft, offset shadow gives the globe weight without a luminous halo.
        const shadow = ctx.createRadialGradient(cx + radius * .10, cy + radius * 1.05, 0, cx + radius * .10, cy + radius * 1.05, radius * .73);
        shadow.addColorStop(0, '#00000060'); shadow.addColorStop(1, '#00000000');
        ctx.save(); ctx.translate(0, cy + radius * .97); ctx.scale(1, .12); ctx.translate(0, -(cy + radius * .97));
        ctx.fillStyle = shadow; ctx.fillRect(0, 0, width, height * 12); ctx.restore();
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, 2 * Math.PI); ctx.clip();
        ctx.fillStyle = ATLAS_COLORS.ocean; ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
        ctx.beginPath(); path(graticule); ctx.strokeStyle = '#b4cfb228'; ctx.lineWidth = .6; ctx.stroke();
        for (const feature of geography.features) {
            ctx.beginPath(); path(feature);
            ctx.fillStyle = colors.get(feature.properties.code)!; ctx.fill();
            ctx.strokeStyle = ATLAS_COLORS.border; ctx.lineWidth = .65; ctx.stroke();
            // Preserve visible ink for very small visited countries such as Singapore.
            if (colors.get(feature.properties.code) === ATLAS_COLORS.visited && path.area(feature) < 10) {
                const center = project(feature.properties.center);
                if (center) { ctx.beginPath(); ctx.arc(center[0], center[1], 2.3, 0, Math.PI * 2); ctx.fillStyle = ATLAS_COLORS.visited; ctx.fill(); ctx.stroke(); }
            }
        }
        const us = activeUS();
        if (us && states) {
            const visited = new Set(us.states!.filter(state => !state.stop).map(state => state.code));
            for (const state of states) {
                ctx.beginPath(); path(state);
                ctx.fillStyle = visited.has(state.properties.code) ? ATLAS_COLORS.visited : ATLAS_COLORS.unvisited;
                ctx.fill(); ctx.strokeStyle = ATLAS_COLORS.border; ctx.lineWidth = .65; ctx.stroke();
            }
        }
        const destination = destinations.find(destination => destination.id === selected);
        if (destination) for (const feature of geography.features.filter(feature => destination.countryCodes.includes(feature.properties.code))) {
            ctx.beginPath(); path(feature); ctx.strokeStyle = ATLAS_COLORS.selected; ctx.lineWidth = 1.8; ctx.stroke();
        }
        // Restrained spherical shading keeps the three status colors legible.
        const shade = ctx.createRadialGradient(cx - radius * .35, cy - radius * .4, radius * .1, cx, cy, radius);
        shade.addColorStop(0, '#ffffff06'); shade.addColorStop(.65, '#030c0600'); shade.addColorStop(1, '#030c0640');
        ctx.fillStyle = shade; ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
        // Fine great-circle links show the recorded sequence. Broad or omitted
        // stops use dashes rather than implying an exact road, flight, or crossing.
        for (const route of routes) {
            const active = route.stops.some(stop => stop.destinationId === selected || destinations.find(destination => destination.id === stop.destinationId)?.countryCodes.some(code => destination?.countryCodes.includes(code)));
            ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = active ? 1.2 : .85;
            ctx.strokeStyle = active ? '#d2edb6c4' : '#d2edb68c';
            for (let index = 0; index < route.stops.length - 1; index++) {
                const from = route.stops[index].position, to = route.stops[index + 1].position;
                ctx.setLineDash(route.approximateLegs.includes(index) ? [2.5, 3.5] : []);
                ctx.beginPath(); path({ type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }); ctx.stroke();
            }
            ctx.restore();
        }
        for (const place of visitedPlaces) {
            const position = project(place.coordinates!);
            if (!position || !visible.has(place.id)) continue;
            ctx.beginPath(); ctx.arc(position[0], position[1], place.id === selected ? 2.8 : 1.8, 0, Math.PI * 2);
            ctx.fillStyle = '#d2edb6'; ctx.fill();
        }
        ctx.restore();
        layoutMarkers();
        container.dataset.ready = 'true';
    }
    function animate(time: number) {
        frame = 0;
        const elapsed = Math.max(0, (time - (lastTime || time - 16)) / 1000);
        const dt = Math.min(elapsed, .032);
        lastTime = time;
        let moving = false;
        if (target) {
            let distance = 0;
            for (const axis of ['lat', 'lng', 'zoom'] as const) {
                const delta = target[axis] - camera[axis];
                velocity[axis] += (delta * 155 - velocity[axis] * 25) * dt;
                camera[axis] += velocity[axis] * dt;
                distance += Math.abs(delta) + Math.abs(velocity[axis]);
            }
            if (distance < .015) { Object.assign(camera, target); target = null; velocity.lat = velocity.lng = velocity.zoom = 0; }
            moving = true;
        } else if (!dragging && (Math.abs(velocity.lng) + Math.abs(velocity.lat) > .05)) {
            camera.lng += velocity.lng * dt; camera.lat = Math.max(-80, Math.min(80, camera.lat + velocity.lat * dt));
            velocity.lng *= Math.exp(-5 * dt); velocity.lat *= Math.exp(-5 * dt); moving = true;
        } else if (openingRemaining > 0 && !dragging) {
            const step = Math.min(elapsed, openingRemaining); camera.lng += step * 2.3; openingRemaining -= step; moving = true;
        }
        camera.lng = wrapLongitude(camera.lng);
        if (target) target.lng = shortestLongitude(camera.lng, target.lng);
        // The short opening turn paints at 30fps, then stops. Flights and drag
        // keep display cadence; there is no indefinite motion needing a control.
        if (!openingRemaining || dragging || target || time - lastPaint > 30) { draw(); lastPaint = time; }
        if (moving || openingRemaining > 0 || target) schedule(); else lastTime = 0;
    }
    function project(position: Coordinates): [number, number] | null {
        if (geoDistance([camera.lng, camera.lat], [position.lng, position.lat]) >= Math.PI / 2 - .02) return null;
        return projection([position.lng, position.lat]);
    }
    function layoutMarkers() {
        const placed: { id: string; x: number; y: number; marker: Marker }[] = [];
        for (const marker of markers) {
            const selectedCountry = marker.destination.kind !== 'country' || marker.destination.id === selected || marker.airport;
            const quietPlace = hasBeen(marker.destination) && !marker.destination.photos.length && (marker.destination.kind === 'place' || marker.destination.kind === 'region') && marker.destination.id !== selected;
            const point = visible.has(marker.destination.id) && selectedCountry && !quietPlace ? project(marker.position) : null;
            marker.element.hidden = !point;
            if (!point) continue;
            marker.element.style.transform = `translate(${point[0]}px,${point[1]}px)`;
            marker.element.classList.toggle('is-selected', marker.destination.id === selected);
            marker.element.classList.toggle('has-preview', camera.zoom > 1.5 && !!marker.destination.photos.length);
            if (marker.destination.kind === 'place') placed.push({ id: marker.id, x: point[0], y: point[1], marker });
        }
        for (const group of clusterPoints(placed.sort((a, b) => Number(b.marker.destination.id === selected) - Number(a.marker.destination.id === selected)))) {
            const first = group[0].marker;
            first.element.classList.toggle('is-cluster', group.length > 1);
            first.element.dataset.group = group.map(point => point.marker.destination.id).join(',');
            first.element.querySelector('.voyage-marker-count')!.textContent = String(group.length);
            for (const point of group.slice(1)) point.marker.element.hidden = true;
        }
    }
    function addMarker(destination: Destination, position: Coordinates, airport?: string) {
        const element = document.createElement('div');
        element.className = `voyage-marker is-${airport ? 'airport' : destination.kind}${hasBeen(destination) ? ' is-been' : ''}`;
        element.classList.toggle('has-photos', destination.photos.length > 0);
        const button = document.createElement('button'); button.type = 'button';
        const name = airport || destination.name;
        button.setAttribute('aria-label', airport ? `${name} — ${destination.name}` : `Show ${name}`);
        const symbol = document.createElement('span'); symbol.className = 'voyage-marker-symbol'; symbol.setAttribute('aria-hidden', 'true');
        if (destination.photos.length && !airport) symbol.innerHTML = cameraIcon;
        button.append(symbol);
        const label = document.createElement('span'); label.className = 'voyage-marker-label'; label.textContent = name; button.append(label);
        const count = document.createElement('span'); count.className = 'voyage-marker-count'; count.setAttribute('aria-hidden', 'true'); button.append(count);
        if (destination.photos.length && !airport) {
            const photo = destination.photos.find(photo => photo.cover) || destination.photos[0];
            const image = document.createElement('img'); image.className = 'voyage-marker-preview'; image.src = photo.thumbnail; image.alt = ''; image.loading = 'lazy'; button.append(image);
            image.addEventListener('error', () => { image.remove(); element.classList.add('preview-unavailable'); }, { signal });
        }
        button.addEventListener('click', () => {
            const group = element.dataset.group?.split(',') || [];
            if (group.length > 1) options.onCluster(group); else options.onSelect(destination.id);
            if (airport) go(position, 1.75);
        }, { signal });
        element.append(button); container.append(element);
        markers.push({ id: airport ? `${destination.id}:${airport}` : destination.id, destination, position, element, airport: !!airport });
    }
    for (const destination of destinations) {
        const position = destination.coordinates || destination.focus;
        if (position && destination.kind !== 'idea') addMarker(destination, position);
        for (const state of destination.states || []) if (state.stop) addMarker(destination, state.stop, state.stopLabel || state.code);
    }
    function resize() {
        const bounds = container.getBoundingClientRect(); width = bounds.width; height = bounds.height;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
        canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw(); schedule();
    }
    const observer = new ResizeObserver(resize); observer.observe(container);
    const intersection = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; lastTime = 0; if (inView) schedule(); else { cancelAnimationFrame(frame); frame = 0; } });
    intersection.observe(container);
    const point = (event: {clientX: number; clientY: number}): [number, number] => { const box = canvas.getBoundingClientRect(); return [event.clientX - box.left, event.clientY - box.top]; };
    function placeAt(point: [number, number], radius = 9) {
        let nearest: Destination | null = null, distance = radius;
        for (const place of visitedPlaces) {
            const screen = visible.has(place.id) ? project(place.coordinates!) : null;
            if (!screen) continue;
            const delta = Math.hypot(screen[0] - point[0], screen[1] - point[1]);
            if (delta < distance) { nearest = place; distance = delta; }
        }
        return nearest;
    }
    function featureAt(point: [number, number]) {
        const coordinates = globePoint(projection, point);
        if (!coordinates) return null;
        const us = activeUS();
        if (us && states) { const state = states.find(state => geoContains(state, coordinates)); if (state) return { feature: state, state: true }; }
        const feature = geography.features.find(feature => geoContains(feature, coordinates));
        return feature ? { feature, state: false } : null;
    }
    canvas.addEventListener('pointerdown', event => {
        if (dragging || event.button !== 0 || !globePoint(projection, point(event))) return;
        stop(); canvas.setPointerCapture(event.pointerId);
        dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, time: event.timeStamp, moved: false };
        canvas.classList.add('is-dragging');
    }, { signal });
    canvas.addEventListener('pointermove', event => {
        if (dragging?.id === event.pointerId) {
            const dt = Math.max(8, event.timeStamp - dragging.time) / 1000;
            const scale = 180 / (Math.PI * projection.scale());
            const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
            camera.lng = wrapLongitude(camera.lng - dx * scale); camera.lat = Math.max(-80, Math.min(80, camera.lat + dy * scale));
            velocity.lng = -dx * scale / dt; velocity.lat = dy * scale / dt;
            dragging.moved ||= Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY) > 5;
            Object.assign(dragging, { x: event.clientX, y: event.clientY, time: event.timeStamp }); draw();
            return;
        }
        const place = placeAt(point(event)), hit = featureAt(point(event));
        tooltip.hidden = !place && !hit;
        if (place || hit) { tooltip.textContent = place?.name || hit!.feature.properties.name; const [x, y] = point(event); tooltip.style.left = `${Math.min(width - tooltip.offsetWidth - 10, x + 14)}px`; tooltip.style.top = `${Math.max(8, y - 32)}px`; }
    }, { signal });
    function endDrag(event: PointerEvent) {
        if (dragging?.id !== event.pointerId) return;
        const moved = dragging.moved; const fresh = event.timeStamp - dragging.time < 80;
        dragging = null; canvas.classList.remove('is-dragging');
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        if (!fresh || reduceMotion.matches || event.type === 'pointercancel') velocity.lat = velocity.lng = 0;
        if (!moved && event.type === 'pointerup') {
            velocity.lat = velocity.lng = 0;
            const place = placeAt(point(event), event.pointerType === 'touch' ? 22 : 9), hit = featureAt(point(event));
            if (place) options.onSelect(place.id);
            else if (hit?.state) go(hit.feature.properties.center, 1.75);
            else if (hit && countryIds.has(hit.feature.properties.code)) options.onCountry(hit.feature.properties.code);
        }
        schedule();
    }
    canvas.addEventListener('pointerup', endDrag, { signal }); canvas.addEventListener('pointercancel', endDrag, { signal });
    canvas.addEventListener('pointerleave', () => { tooltip.hidden = true; }, { signal });
    canvas.addEventListener('wheel', event => {
        if (!globePoint(projection, point(event))) return;
        event.preventDefault(); go(camera, Math.max(.75, Math.min(2.5, (target?.zoom || camera.zoom) * Math.exp(-event.deltaY * .0015))));
    }, { passive: false, signal });
    canvas.addEventListener('keydown', event => {
        const rotations: Record<string, [number, number]> = { ArrowLeft: [12, 0], ArrowRight: [-12, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] };
        if (rotations[event.key]) { event.preventDefault(); stop(); camera.lng += rotations[event.key][0]; camera.lat = Math.max(-80, Math.min(80, camera.lat + rotations[event.key][1])); draw(); }
        else if (event.key === '+' || event.key === '=' || event.key === '-') { event.preventDefault(); stop(); camera.zoom = Math.max(.75, Math.min(2.5, camera.zoom * (event.key === '-' ? .82 : 1.22))); draw(); }
        else if (event.key === ' ') { event.preventDefault(); stop(); }
    }, { signal });
    document.addEventListener('visibilitychange', () => { lastTime = 0; if (!document.hidden) schedule(); else { cancelAnimationFrame(frame); frame = 0; } }, { signal });
    reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) { stop(); draw(); } }, { signal });
    resize(); schedule();
    return {
        select(id) {
            selected = id;
            const destination = destinations.find(destination => destination.id === id);
            if (destination?.focus) go(destination.focus, destination.kind === 'place' ? 1.65 : 1.12);
            else { openingRemaining = 0; schedule(); }
            if (activeUS()) void loadStates();
        },
        focus(position) { go(position, 1.75); },
        show(ids) { visible = new Set(ids); schedule(); },
        zoom(direction) { go(camera, Math.max(.75, Math.min(2.5, (target?.zoom || camera.zoom) * (direction > 0 ? 1.22 : .82)))); },
        reset() { selected = null; go({ lat: 22, lng: 80 }, 1); },
        resize,
        destroy() {
            if (disposed) return;
            disposed = true; abort.abort(); cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); container.replaceChildren();
        },
    };
}
