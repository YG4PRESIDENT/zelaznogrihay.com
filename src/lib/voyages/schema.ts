import { z } from 'astro/zod';
import { dateUpperBound, dateValue, isTravelDate, US_STATES } from './model.ts';

const travelDate = z.string().refine(isTravelDate, 'Use a real date: YYYY, YYYY-MM, or YYYY-MM-DD.');
const coordinates = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens.');
const webUrl = z.string().url().refine(value => /^https?:\/\//i.test(value), 'Use an http or https link.');

export function createDestinationSchema<T extends z.ZodType>(image: T) {
    return z.object({
        name: z.string().trim().min(1),
        kind: z.enum(['country', 'place', 'region', 'idea']),
        countryCodes: z.array(z.string().regex(/^[A-Z]{2}$/)).default([]),
        coordinates: coordinates.optional(),
        focus: coordinates.optional(),
        visited: z.boolean().default(false),
        experience: z.enum(['visited', 'passed-through', 'lived']).optional(),
        states: z.array(z.object({ code: z.string().refine(code => Object.hasOwn(US_STATES, code), 'Use a US state abbreviation.'), stop: coordinates.optional(), stopLabel: z.string().optional() })).default([]),
        summary: z.string().optional(),
        companions: z.string().trim().min(1).optional(),
        purpose: z.string().trim().min(1).optional(),
        order: z.number().default(100),
        visits: z.array(z.object({
            id: slug, title: z.string().optional(), date: travelDate.optional(),
            endDate: travelDate.optional(), memories: z.string().optional(),
        })).default([]),
        plans: z.array(z.object({
            title: z.string().trim().min(1), timeframe: z.string().optional(), date: travelDate.optional(),
            thingsToDo: z.array(z.string()).default([]), gettingThere: z.string().optional(), notes: z.string().optional(),
            links: z.array(z.object({ label: z.string().min(1), url: webUrl })).default([]),
        })).default([]),
        photos: z.array(z.object({
            src: image, alt: z.string().trim().min(1), caption: z.string().optional(),
            visit: slug.optional(), cover: z.boolean().default(false),
        })).default([]),
    }).superRefine((destination, context) => {
        const issue = (path: (string | number)[], message: string) => context.addIssue({ code: 'custom', path, message });
        if (destination.kind === 'place' && !destination.coordinates) issue(['coordinates'], 'A specific place needs latitude and longitude.');
        if (destination.kind !== 'place' && destination.coordinates) issue(['coordinates'], 'Use focus for a broad region; exact pins belong to specific places.');
        if ((destination.kind === 'country' || destination.kind === 'place') && !destination.countryCodes.length) issue(['countryCodes'], 'Add at least one ISO country code.');
        if (destination.kind === 'idea' && (destination.coordinates || destination.focus || destination.countryCodes.length)) issue(['kind'], 'An unplaced idea has no map location; choose country, region, or place when its location is known.');
        const visitIds = new Set<string>();
        if (destination.states.length && !destination.countryCodes.includes('US')) issue(['states'], 'US states belong to the United States entry.');
        if (new Set(destination.states.map(state => state.code)).size !== destination.states.length) issue(['states'], 'List each state once.');
        destination.visits.forEach((visit, index) => {
            if (visitIds.has(visit.id)) issue(['visits', index, 'id'], 'Visit IDs must be unique within a destination.');
            visitIds.add(visit.id);
            if (visit.endDate && !visit.date) issue(['visits', index, 'endDate'], 'Add a start date before an end date.');
            if (visit.date && visit.endDate && dateUpperBound(visit.endDate) < dateValue(visit.date)) issue(['visits', index, 'endDate'], 'The end date must follow the start date.');
        });
        destination.photos.forEach((photo, index) => {
            if (photo.visit && !visitIds.has(photo.visit)) issue(['photos', index, 'visit'], 'This photo refers to an unknown visit ID.');
        });
        if (destination.photos.filter(photo => photo.cover).length > 1) issue(['photos'], 'Choose one cover photo.');
    });
}
