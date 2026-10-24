import Globe, { type GlobeInstance } from 'globe.gl';
import { AmbientLight, BufferGeometry, Color, DirectionalLight, Float32BufferAttribute, LineBasicMaterial, LineSegments, MeshPhongMaterial } from 'three';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { clusterPoints, getCountryStatus, hasBeen, type Country, type Destination, type Coordinates } from './model';
import { GLOBE_RENDERING } from './rendering';

type CountryFeature = Feature<Polygon | MultiPolygon, Country>;
type Marker = { id: string; destination: Destination; position: Coordinates; element: HTMLDivElement; front: boolean; group: string[]; airport?: boolean };

interface GlobeOptions {
    container: HTMLElement;
    destinations: Destination[];
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
    resize: (detailOpen: boolean) => void;
    destroy: () => void;
}

const cameraIcon = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M3 5.5h3l1.5-2h5l1.5 2h3v11H3z"/><circle cx="10" cy="10.5" r="3"/></svg>';

export async function createGlobe(options: GlobeOptions): Promise<AtlasGlobe> {
    const response = await fetch('/data/voyages/countries.json');
    if (!response.ok) throw new Error(`Country outlines returned ${response.status}`);
    const geography = await response.json() as FeatureCollection<Polygon | MultiPolygon, Country>;
    const { container, destinations } = options;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = matchMedia('(min-width: 1024px)');
    let selected: string | null = null;
    let visible = new Set(destinations.map(destination => destination.id));
    let cameraFrame = 0;
    let markerFrame = 0;
    let disposed = false;
    let detailOpen = false;
    let activeCamera: { lat: number; lng: number; altitude: number; latV: number; lngV: number; altitudeV: number } | null = null;
    const markers: Marker[] = [];
    let countryStatuses = new Map(geography.features.map(feature => [feature.properties.code, getCountryStatus(destinations, feature.properties.code)]));
    const surfaceDepth = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 };
    const land = new MeshPhongMaterial({ color: '#273a2b', specular: '#899b72', shininess: 9, ...surfaceDepth });
    const visitedLand = new MeshPhongMaterial({ color: '#496d38', specular: '#a5bd88', shininess: 12, ...surfaceDepth });
    const selectedLand = new MeshPhongMaterial({ color: '#4b5540', specular: '#b8ba8d', shininess: 13, ...surfaceDepth });
    const coast = new MeshPhongMaterial({ color: '#101b10', shininess: 0 });
    const ocean = new MeshPhongMaterial({ color: '#0d1912', specular: new Color('#25402b'), shininess: 18 });
    const countryMaterial = (feature: CountryFeature) => {
        if (selected && destinations.find(destination => destination.id === selected)?.countryCodes.includes(feature.properties.code)) return selectedLand;
        return countryStatuses.get(feature.properties.code)?.visited ? visitedLand : land;
    };
    const globe: GlobeInstance = new Globe(container, { animateIn: false, rendererConfig: { antialias: true, alpha: true, powerPreference: 'low-power' } });
    globe.backgroundColor('#00000000').globeMaterial(ocean)
        .showAtmosphere(true).atmosphereColor('#6d8d5a').atmosphereAltitude(.075)
        .globeCurvatureResolution(GLOBE_RENDERING.surfaceCurvature)
        .polygonsData(geography.features).polygonCapCurvatureResolution(GLOBE_RENDERING.countryCurvature)
        .polygonSideMaterial(coast).polygonAltitude(GLOBE_RENDERING.countryAltitude).polygonsTransitionDuration(0)
        .polygonCapMaterial(object => countryMaterial(object as CountryFeature))
        .polygonStrokeColor('')
        .polygonLabel(() => '')
        .onPolygonClick(object => {
            const code = (object as CountryFeature).properties.code;
            if (countryStatuses.get(code)?.destinations.length) options.onCountry(code);
        })
        .showPointerCursor((type, data) => type === 'polygon' && !!countryStatuses.get((data as CountryFeature)?.properties?.code)?.destinations.length)
        .pointOfView({ lat: 18, lng: 15, altitude: desktop.matches ? 1.85 : 2.05 }, 0);
    globe.renderer().setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const controls = globe.controls();
    controls.enablePan = false;
    controls.enableDamping = !reduceMotion.matches;
    controls.dampingFactor = .085;
    controls.rotateSpeed = .55;
    controls.zoomSpeed = .65;
    controls.minDistance = globe.getGlobeRadius() * 1.3;
    controls.maxDistance = globe.getGlobeRadius() * 6;
    controls.autoRotate = false;
    const key = new DirectionalLight('#f0e6bd', 2.1);
    key.position.set(-250, 250, 350);
    const fill = new DirectionalLight('#8ba078', .65);
    fill.position.set(300, -100, -250);
    globe.lights([new AmbientLight('#b8c3a5', 1.25), key, fill]);

    // Fine geographic linework is drawn independently so its weight and contrast
    // can echo the engraved ship without the library's bright default grid.
    const gridPositions: number[] = [];
    const segment = (a: Coordinates, b: Coordinates) => {
        const start = globe.getCoords(a.lat, a.lng, .001);
        const end = globe.getCoords(b.lat, b.lng, .001);
        gridPositions.push(start.x, start.y, start.z, end.x, end.y, end.z);
    };
    for (let lng = -180; lng < 180; lng += 30) for (let lat = -90; lat < 90; lat += 2) segment({ lat, lng }, { lat: lat + 2, lng });
    for (let lat = -60; lat <= 60; lat += 30) for (let lng = -180; lng < 180; lng += 2) segment({ lat, lng }, { lat, lng: lng + 2 });
    const gridGeometry = new BufferGeometry();
    gridGeometry.setAttribute('position', new Float32BufferAttribute(gridPositions, 3));
    const gridMaterial = new LineBasicMaterial({ color: '#9eab82', transparent: true, opacity: .15, depthWrite: false });
    const grid = new LineSegments(gridGeometry, gridMaterial);
    grid.raycast = () => {};
    globe.scene().add(grid);

    // Neighboring countries share one border, rather than drawing competing
    // coplanar strokes. This also avoids bright, doubled coastlines in motion.
    const borderPositions: number[] = [];
    const seenEdges = new Set<string>();
    for (const feature of geography.features) {
        const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        for (const polygon of polygons) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
            const a = ring[i - 1], b = ring[i];
            const key = [a.join(','), b.join(',')].sort().join('|');
            if (seenEdges.has(key)) continue;
            seenEdges.add(key);
            const start = globe.getCoords(a[1], a[0], GLOBE_RENDERING.borderAltitude);
            const end = globe.getCoords(b[1], b[0], GLOBE_RENDERING.borderAltitude);
            borderPositions.push(start.x,start.y,start.z,end.x,end.y,end.z);
        }
    }
    const borderGeometry = new BufferGeometry();
    borderGeometry.setAttribute('position',new Float32BufferAttribute(borderPositions,3));
    const borderMaterial = new LineBasicMaterial({color:'#91a47c',transparent:true,opacity:.28,depthWrite:false});
    const borders = new LineSegments(borderGeometry,borderMaterial);
    borders.renderOrder = 2;
    borders.raycast = () => {};
    globe.scene().add(borders);

    const tooltip = document.createElement('div');
    tooltip.className = 'voyages-tooltip';
    tooltip.hidden = true;
    container.appendChild(tooltip);
    const moveTooltip = (event: PointerEvent) => {
        const box = container.getBoundingClientRect();
        tooltip.style.left = `${Math.min(event.clientX - box.left + 16, box.width - tooltip.offsetWidth - 12)}px`;
        tooltip.style.top = `${Math.max(10, event.clientY - box.top - 30)}px`;
    };
    container.addEventListener('pointermove', moveTooltip);
    container.addEventListener('pointerleave', () => { tooltip.hidden = true; });
    globe.onPolygonHover(object => {
        tooltip.hidden = !object;
        if (object) tooltip.textContent = (object as CountryFeature).properties.name;
    });

    function scheduleMarkers() {
        if (!markerFrame && !disposed) markerFrame = requestAnimationFrame(layoutMarkers);
    }
    function layoutMarkers() {
        markerFrame = 0;
        const near = globe.pointOfView().altitude < 1.15;
        const points = markers.filter(marker => marker.front && visible.has(marker.destination.id) && marker.destination.kind === 'place')
            .sort((a, b) => Number(b.destination.id === selected) - Number(a.destination.id === selected))
            .map(marker => ({ id: marker.id, ...globe.getScreenCoords(marker.position.lat, marker.position.lng, .015) }));
        const groups = clusterPoints(points, near ? 68 : 40);
        const grouped = new Map(groups.flatMap(group => group.map((point, index) => [point.id, { ids: group.map(item => item.id), first: index === 0 }] as const)));
        for (const marker of markers) {
            const group = grouped.get(marker.id);
            marker.group = group?.ids || [marker.id];
            const hidden = !marker.front || !visible.has(marker.destination.id) || (group && !group.first);
            marker.element.style.visibility = hidden ? 'hidden' : 'visible';
            const button = marker.element.querySelector('button')!;
            button.tabIndex = hidden ? -1 : 0;
            marker.element.classList.toggle('is-cluster', marker.group.length > 1);
            marker.element.classList.toggle('is-selected', selected === marker.destination.id);
            const photo = marker.destination.photos.find(photo => photo.cover) || marker.destination.photos[0];
            const preview = marker.element.querySelector<HTMLImageElement>('.voyage-marker-preview');
            const showPhoto = near && !!photo && !!preview && marker.destination.kind === 'place' && marker.group.length === 1;
            marker.element.classList.toggle('has-preview', showPhoto);
            if (preview && showPhoto && !preview.getAttribute('src')) preview.src = photo.thumbnail;
            marker.element.querySelector('.voyage-marker-count')!.textContent = String(marker.group.length);
            button.setAttribute('aria-label', marker.airport ? marker.element.querySelector('.voyage-marker-label')!.textContent! : marker.group.length > 1 ? `Explore ${marker.group.length} nearby places` : `${marker.destination.name}${photo ? ', photos available' : ''}`);
        }
    }

    const markerEntries = destinations.flatMap(destination => [
        ...(!(destination.kind === 'country' && hasBeen(destination)) ? [{id:destination.id,destination,position:destination.coordinates || destination.focus,airport:false,label:destination.name}] : []),
        ...(destination.states || []).filter(state => state.stop).map(state => ({id:`${destination.id}:${state.code}`,destination,position:state.stop,airport:true,label:state.stopLabel || state.code})),
    ]);
    for (const {id,destination,position,airport,label:markerLabel} of markerEntries) {
        if (!position || destination.kind === 'idea') continue;
        const element = document.createElement('div');
        element.className = `voyage-marker is-${airport ? 'airport' : destination.kind}${hasBeen(destination) ? ' is-been' : ''}`;
        element.dataset.destination = destination.id;
        const button = document.createElement('button');
        button.type = 'button';
        const symbol = document.createElement('span');
        symbol.className = 'voyage-marker-symbol';
        symbol.innerHTML = destination.photos.length ? cameraIcon : hasBeen(destination) ? '•' : '◇';
        const label = document.createElement('span');
        label.className = 'voyage-marker-label';
        label.textContent = markerLabel;
        const count = document.createElement('span');
        count.className = 'voyage-marker-count';
        count.setAttribute('aria-hidden', 'true');
        button.append(symbol);
        if (destination.photos.length && destination.kind === 'place') {
            const preview = document.createElement('img');
            preview.className = 'voyage-marker-preview';
            preview.alt = '';
            preview.decoding = 'async';
            preview.addEventListener('error', () => { preview.remove(); element.classList.remove('has-preview'); });
            button.appendChild(preview);
        }
        button.append(label, count);
        element.appendChild(button);
        const marker: Marker = { id, destination, position, element, front: false, group: [id], airport };
        markers.push(marker);
        button.addEventListener('click', event => {
            event.stopPropagation();
            if (marker.group.length > 1) {
                options.onCluster(marker.group);
                animateTo({ ...position, altitude: Math.max(.3, globe.pointOfView().altitude * .65) });
            } else {
                options.onSelect(destination.id);
                if (airport) animateTo({...position,altitude:.7});
            }
        });
    }
    globe.htmlElementsData(markers).htmlLat(object => (object as Marker).position.lat).htmlLng(object => (object as Marker).position.lng)
        .htmlAltitude(.015).htmlElement(object => (object as Marker).element).htmlTransitionDuration(0)
        .htmlElementVisibilityModifier((element, front) => {
            const marker = markers.find(marker => marker.element === element);
            if (marker && marker.front !== front) { marker.front = front; scheduleMarkers(); }
        });
    globe.onZoom(coordinates => { options.onCoordinates(coordinates); scheduleMarkers(); });

    function stopCamera() {
        cancelAnimationFrame(cameraFrame);
        cameraFrame = 0;
        activeCamera = null;
        controls.enableDamping = !reduceMotion.matches;
    }
    controls.addEventListener('start', stopCamera);
    function animateTo(target: { lat: number; lng: number; altitude: number }) {
        cancelAnimationFrame(cameraFrame);
        // Flush residual drag velocity before a programmatic camera movement.
        controls.enableDamping = false;
        controls.update();
        const current = globe.pointOfView();
        while (target.lng - current.lng > 180) target.lng -= 360;
        while (target.lng - current.lng < -180) target.lng += 360;
        if (reduceMotion.matches) { stopCamera(); globe.pointOfView(target, 0); return; }
        const state = { ...current, latV: activeCamera?.latV || 0, lngV: activeCamera?.lngV || 0, altitudeV: activeCamera?.altitudeV || 0 };
        activeCamera = state;
        let previous = performance.now();
        const started = previous;
        const tick = (now: number) => {
            if (disposed) return;
            const dt = Math.min((now - previous) / 1000, .025);
            previous = now;
            for (const key of ['lat', 'lng', 'altitude'] as const) {
                const velocity = `${key}V` as 'latV' | 'lngV' | 'altitudeV';
                state[velocity] += ((target[key] - state[key]) * 165 - state[velocity] * 26) * dt;
                state[key] += state[velocity] * dt;
            }
            globe.pointOfView({ lat: state.lat, lng: state.lng, altitude: state.altitude }, 0);
            if (now - started < 1600 && (Math.abs(state.lat - target.lat) + Math.abs(state.lng - target.lng) + Math.abs(state.altitude - target.altitude) > .002)) cameraFrame = requestAnimationFrame(tick);
            else { globe.pointOfView(target, 0); activeCamera = null; cameraFrame = 0; controls.enableDamping = !reduceMotion.matches; }
        };
        cameraFrame = requestAnimationFrame(tick);
    }
    function resize(open: boolean) {
        detailOpen = open;
        const { width, height } = container.getBoundingClientRect();
        globe.width(width).height(height);
        const targetOffset: [number, number] = desktop.matches ? [Math.min(150, width * .11), 12] : [0, 22];
        globe.globeOffset(targetOffset);
        scheduleMarkers();
    }
    const observer = new ResizeObserver(() => resize(detailOpen));
    observer.observe(container);
    const visibility = () => {
        if (document.hidden) { stopCamera(); globe.pauseAnimation(); }
        else { globe.resumeAnimation(); scheduleMarkers(); }
    };
    document.addEventListener('visibilitychange', visibility);
    const motionChange = () => { controls.enableDamping = !reduceMotion.matches; if (reduceMotion.matches) stopCamera(); };
    reduceMotion.addEventListener('change', motionChange);
    resize(false);
    scheduleMarkers();

    return {
        focus(position) { animateTo({...position,altitude:.7}); },
        select(id) {
            selected = id;
            globe.polygonCapMaterial(object => countryMaterial(object as CountryFeature));
            const destination = destinations.find(destination => destination.id === id);
            if (destination?.focus) animateTo({ ...destination.focus, altitude: destination.kind === 'place' ? .8 : destination.kind === 'region' ? 1.85 : 1.2 });
            scheduleMarkers();
        },
        show(ids) {
            visible = new Set(ids);
            const shownDestinations = destinations.filter(destination => visible.has(destination.id));
            countryStatuses = new Map(geography.features.map(feature => [feature.properties.code, getCountryStatus(shownDestinations, feature.properties.code)]));
            globe.polygonCapMaterial(object => countryMaterial(object as CountryFeature));
            scheduleMarkers();
        },
        zoom(direction) { const current = globe.pointOfView(); animateTo({ ...current, altitude: Math.max(.3, Math.min(5, current.altitude * (direction > 0 ? .72 : 1.35))) }); },
        reset() { animateTo({ lat: 18, lng: 15, altitude: desktop.matches ? 1.85 : 2.05 }); },
        resize,
        destroy() {
            disposed = true;
            stopCamera(); cancelAnimationFrame(markerFrame);
            observer.disconnect();
            document.removeEventListener('visibilitychange', visibility);
            reduceMotion.removeEventListener('change', motionChange);
            container.removeEventListener('pointermove', moveTooltip);
            controls.removeEventListener('start', stopCamera);
            gridGeometry.dispose(); gridMaterial.dispose();
            borderGeometry.dispose(); borderMaterial.dispose();
            for (const material of [land, visitedLand, selectedLand, coast, ocean]) material.dispose();
            globe._destructor();
            container.replaceChildren();
        },
    };
}
