import { getCollection } from 'astro:content';
import { getImage } from 'astro:assets';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import countryIndex from '../../data/voyages-countries.json';
import stateIndex from '../../data/voyages-us-states.json';
import type { Country, Destination } from './model';

export const countries: Country[] = countryIndex;

export async function getDestinations(): Promise<Destination[]> {
    const entries = (await getCollection('voyages')).sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name));
    return Promise.all(entries.map(async entry => {
        const data = entry.data;
        for (const code of data.countryCodes) {
            if (!countries.some(country => country.code === code)) throw new Error(`Voyages: ${entry.id} has unknown country code ${code}.`);
        }
        const photos = await Promise.all(data.photos.map(async photo => {
            const [full, thumbnail] = await Promise.all([
                getImage({ src: photo.src, width: Math.min(1800, photo.src.width), format: 'webp' }),
                getImage({ src: photo.src, width: Math.min(240, photo.src.width), format: 'webp' }),
            ]);
            return { ...photo, src: full.src, thumbnail: thumbnail.src,
                width: Number(full.attributes.width), height: Number(full.attributes.height) };
        }));
        return {
            ...data, id: entry.id, photos,
            states: data.states.map(state => ({ ...state, focus: state.stop || stateIndex.find(item => item.code === state.code)?.center })),
            focus: data.coordinates || data.focus || countries.find(country => data.countryCodes.includes(country.code))?.center,
            html: sanitizeHtml(await marked.parse(entry.body || ''), {
                allowedTags: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'code', 'pre', 'hr'],
                allowedAttributes: { a: ['href', 'title'] }, allowedSchemes: ['https', 'http', 'mailto'],
            }),
        };
    }));
}
