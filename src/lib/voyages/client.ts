import { formatTravelDate, type Coordinates, type Country, type Destination } from './model.ts';
import type { AtlasGlobe } from './globe.ts';

export function initVoyages(loadGlobe: () => Promise<Pick<typeof import('./globe.ts'), 'createGlobe'>> = () => import('./globe.ts')) {
    const root = document.getElementById('voyages');
    if (!root || root.dataset.initialized) return;
    const payload = document.getElementById('voyages-data')?.textContent;
    if (!payload) return;
    let data: {destinations: Destination[]; countries: Country[]};
    try { data = JSON.parse(payload); } catch { return; }
    root.dataset.initialized = 'true';
    const {destinations} = data;
    const find = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
    const abort = new AbortController();
    const {signal} = abort;
    const live = find('voyages-live');
    const canvas = find('voyages-canvas');
    const status = find('voyages-map-status');
    let selected: string | null = null;
    let globe: AtlasGlobe | null = null;
    let disposed = false;
    const entries = [...root.querySelectorAll<HTMLDetailsElement>('.voyages-place[data-destination]')];
    const entryFor = (id: string) => entries.find(entry => entry.dataset.destination === id);
    function updateUrl(id: string | null) {
        const url = new URL(location.href);
        if (id) url.searchParams.set('destination', id); else url.searchParams.delete('destination');
        if (url.hash.startsWith('#destination-')) url.hash = '';
        if (url.href !== location.href) history.pushState(null, '', url);
    }
    function select(id: string, options: {history?: boolean; scroll?: boolean} = {}) {
        const destination = destinations.find(destination => destination.id === id);
        const entry = entryFor(id);
        if (!destination || !entry) return;
        selected = id;
        entry.open = true;
        for (const row of entries) row.classList.toggle('is-selected', row.dataset.destination === id);
        globe?.select(id);
        if (options.history) updateUrl(id);
        if (options.scroll) entry.scrollIntoView?.({block:'nearest', behavior:'auto'});
        live.textContent = destination.name;
    }
    function readSelection() {
        const id = new URL(location.href).searchParams.get('destination') || (location.hash.startsWith('#destination-') ? location.hash.slice(13) : null);
        if (id) select(id, {scroll: true});
        else {
            if (selected) for (const entry of entries) if (entry.dataset.destination === selected) entry.open = false;
            selected = null; globe?.select(null);
            for (const entry of entries) entry.classList.remove('is-selected');
        }
    }
    root.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        const summary = target?.closest('summary');
        const entry = summary?.closest<HTMLDetailsElement>('.voyages-place');
        if (entry?.dataset.destination) {
            event.preventDefault();
            if (entry.open) {
                entry.open = false;
                if (selected === entry.dataset.destination) { selected = null; entry.classList.remove('is-selected'); globe?.select(null); updateUrl(null); }
            } else select(entry.dataset.destination, {history: true});
            return;
        }
        const stop = target?.closest<HTMLElement>('[data-state-stop]');
        if (stop) { globe?.focus({lat:Number(stop.dataset.lat),lng:Number(stop.dataset.lng)}); return; }
        const mapButton = target?.closest<HTMLElement>('[data-map-action]');
        if (mapButton) globe?.zoom(mapButton.dataset.mapAction === 'in' ? 1 : -1);
        const photoButton = target?.closest<HTMLElement>('[data-photo]');
        const photoEntry = photoButton?.closest<HTMLElement>('[data-destination]');
        if (photoButton && photoEntry?.dataset.destination) openGallery(photoEntry.dataset.destination, Number(photoButton.dataset.photo));
    }, {signal});
    const dialog = find<HTMLDialogElement>('voyages-lightbox');
    const image = find<HTMLImageElement>('voyages-photo-image');
    const previous = find<HTMLButtonElement>('voyages-photo-prev');
    const next = find<HTMLButtonElement>('voyages-photo-next');
    let gallery: Destination | null = null;
    let photoIndex = 0;
    let previousOverflow = '';
    function showPhoto(index: number) {
        if (!gallery?.photos.length) return;
        photoIndex = (index + gallery.photos.length) % gallery.photos.length;
        const photo = gallery.photos[photoIndex];
        image.hidden = false; find('voyages-photo-error').hidden = true;
        image.alt = photo.alt; image.width = photo.width; image.height = photo.height; image.src = photo.src;
        find('voyages-photo-title').textContent = gallery.name;
        find('voyages-photo-count').textContent = `${photoIndex + 1} / ${gallery.photos.length}`;
        const visit = gallery.visits.find(visit => visit.id === photo.visit);
        find('voyages-photo-caption').textContent = [photo.caption || photo.alt, visit?.date ? formatTravelDate(visit.date) : ''].filter(Boolean).join(' · ');
        previous.disabled = next.disabled = gallery.photos.length < 2;
    }
    function openGallery(id: string, index: number) {
        gallery = destinations.find(destination => destination.id === id) || null;
        if (!gallery?.photos.length) return;
        showPhoto(index); previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
        dialog.showModal(); find('voyages-photo-close').focus();
    }
    previous.addEventListener('click', () => showPhoto(photoIndex-1), {signal});
    next.addEventListener('click', () => showPhoto(photoIndex+1), {signal});
    find('voyages-photo-close').addEventListener('click', () => dialog.close(), {signal});
    dialog.addEventListener('close', () => {document.body.style.overflow = previousOverflow;}, {signal});
    dialog.addEventListener('click', event => {if(event.target===dialog) dialog.close();}, {signal});
    dialog.addEventListener('keydown', event => {
        if(event.key==='ArrowLeft'){event.preventDefault();showPhoto(photoIndex-1);}
        if(event.key==='ArrowRight'){event.preventDefault();showPhoto(photoIndex+1);}
    }, {signal});
    image.addEventListener('error', () => {image.hidden=true;find('voyages-photo-error').hidden=false;}, {signal});
    root.addEventListener('error', event => {
        if (!(event.target instanceof HTMLImageElement) || !event.target.closest('.voyages-gallery')) return;
        const missing = document.createElement('span'); missing.className='voyages-image-missing';missing.textContent='Photo unavailable';event.target.replaceWith(missing);
    }, {capture:true,signal});
    window.addEventListener('popstate', () => {if(dialog.open)dialog.close();readSelection();}, {signal});
    function sizeStage() {
        const top = root!.getBoundingClientRect().top + window.scrollY;
        root!.style.setProperty('--atlas-height', `${Math.max(0,window.innerHeight-top)}px`);
    }
    const observer = new ResizeObserver(sizeStage);
    const header = document.getElementById('main-header'); if(header)observer.observe(header);
    window.addEventListener('resize', sizeStage, {signal});sizeStage();readSelection();
    void (async () => {
        try {
            const {createGlobe}=await loadGlobe();if(disposed)return;
            const instance=await createGlobe({container:canvas,destinations,onSelect:id=>select(id,{history:true,scroll:true}),onCountry:code=>{
                const destination=destinations.find(destination=>destination.countryCodes.includes(code));if(destination)select(destination.id,{history:true,scroll:true});
            },onCluster:ids=>{if(ids[0])select(ids[0],{history:true,scroll:true});},onCoordinates:()=>{}});
            if(disposed){instance.destroy();return;}
            globe=instance;status.hidden=true;find('voyages-map-tools').hidden=false;if(selected)globe.select(selected);
        } catch(error) {
            if(disposed)return;console.error('The travel globe could not be loaded.',error);canvas.replaceChildren();status.textContent='The globe is unavailable. All destinations are in the list.';status.hidden=false;
        }
    })();
    const cleanup=()=>{disposed=true;if(dialog.open)dialog.close();abort.abort();observer.disconnect();globe?.destroy();delete root.dataset.initialized;};
    document.addEventListener('astro:before-swap',cleanup,{once:true,signal});if(import.meta.hot)import.meta.hot.dispose(cleanup);
}
