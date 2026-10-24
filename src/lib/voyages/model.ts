export type Coordinates = { lat: number; lng: number };
export type DestinationKind = 'country' | 'place' | 'region' | 'idea';
export type TravelFilter = 'all' | 'been' | 'wanted';
export type TravelExperience = 'visited' | 'passed-through' | 'lived';
export interface StateVisit { code: string; stop?: Coordinates; stopLabel?: string; focus?: Coordinates }
export const US_STATES: Record<string, string> = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

export interface Visit {
    id: string;
    title?: string;
    date?: string;
    endDate?: string;
    memories?: string;
}

export interface TravelPlan {
    title: string;
    timeframe?: string;
    date?: string;
    thingsToDo: string[];
    gettingThere?: string;
    notes?: string;
    links: { label: string; url: string }[];
}

export interface TravelPhoto {
    src: string;
    thumbnail: string;
    alt: string;
    caption?: string;
    visit?: string;
    cover: boolean;
    width: number;
    height: number;
}

export interface Destination {
    id: string;
    name: string;
    kind: DestinationKind;
    countryCodes: string[];
    coordinates?: Coordinates;
    focus?: Coordinates;
    visited: boolean;
    experience?: TravelExperience;
    states?: StateVisit[];
    companions?: string;
    summary?: string;
    order: number;
    visits: Visit[];
    plans: TravelPlan[];
    photos: TravelPhoto[];
    html: string;
}

export interface Country {
    code: string;
    name: string;
    continent: string;
    center: Coordinates;
}

export interface RouteDefinition {
    id: string;
    name: string;
    stops: string[];
    approximateLegs?: number[];
}

export interface TravelRoute {
    id: string;
    name: string;
    stops: { destinationId: string; position: Coordinates }[];
    approximateLegs: number[];
}

/** Route order comes only from recorded itineraries, never from country or city order. */
export function resolveRoutes(definitions: RouteDefinition[], destinations: Destination[]): TravelRoute[] {
    const ids = new Set<string>();
    return definitions.map(route => {
        if (ids.has(route.id) || route.stops.length < 2) throw new Error(`Invalid travel route: ${route.id}`);
        ids.add(route.id);
        const approximateLegs = route.approximateLegs || [];
        if (approximateLegs.some(index => !Number.isInteger(index) || index < 0 || index >= route.stops.length - 1)) throw new Error(`Invalid route leg: ${route.id}`);
        const stops = route.stops.map(id => {
            const destination = destinations.find(destination => destination.id === id);
            const position = destination?.coordinates || destination?.focus;
            if (!destination || !hasBeen(destination) || !position) throw new Error(`Unrecorded route stop: ${id}`);
            return { destinationId: id, position };
        });
        return { id: route.id, name: route.name, stops, approximateLegs };
    });
}

export const hasBeen = (destination: Destination) => destination.visited || destination.visits.length > 0;
export const wantsToGo = (destination: Destination) => destination.plans.length > 0;

export function matchesFilter(destination: Destination, filter: TravelFilter): boolean {
    return filter === 'all' || (filter === 'been' ? hasBeen(destination) : wantsToGo(destination));
}

export function matchesSearch(destination: Destination, query: string, countries: Country[]): boolean {
    const text = [destination.name, destination.summary, ...destination.plans.map(plan => plan.title),
        ...destination.countryCodes.map(code => countries.find(country => country.code === code)?.name || code)].join(' ');
    return text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

export function getStats(destinations: Destination[]) {
    const countries = new Set(destinations.filter(hasBeen).flatMap(destination => destination.countryCodes).filter(code => code !== 'AQ'));
    return {
        countries: countries.size,
        places: destinations.filter(destination => destination.kind === 'place' && hasBeen(destination)).length,
        wishes: destinations.reduce((total, destination) => total + destination.plans.length, 0),
    };
}

export function getCountryStatus(destinations: Destination[], code: string) {
    const associated = destinations.filter(destination => destination.countryCodes.includes(code));
    return { visited: associated.some(hasBeen), wanted: associated.some(wantsToGo), destinations: associated };
}

export function isTravelDate(value: string): boolean {
    if (!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) return false;
    const [year, month = 1, day = 1] = value.split('-').map(Number);
    if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
    return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function dateValue(value: string): number {
    const [year, month = 1, day = 1] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
}

export function dateUpperBound(value: string): number {
    const [year, month, day] = value.split('-').map(Number);
    return day ? Date.UTC(year, month - 1, day) : Date.UTC(year, month || 12, 0);
}

export function formatTravelDate(value?: string): string {
    if (!value || !isTravelDate(value)) return 'Date not recorded';
    const precision = value.split('-').length;
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric', ...(precision >= 2 ? { month: 'short' as const } : {}),
        ...(precision === 3 ? { day: 'numeric' as const } : {}), timeZone: 'UTC',
    }).format(new Date(dateValue(value)));
}

export interface TimelineItem {
    destination: Destination;
    title: string;
    date?: string;
    label: string;
    type: 'visit' | 'plan';
    key: string;
}

export function getTimeline(destinations: Destination[]) {
    const visits: TimelineItem[] = [];
    const plans: TimelineItem[] = [];
    for (const destination of destinations) {
        for (const visit of destination.visits) {
            visits.push({ destination, title: visit.title || destination.name, date: visit.date,
                label: formatTravelDate(visit.date), type: 'visit', key: `${destination.id}:visit:${visit.id}` });
        }
        // A country can be marked visited before a dated trip has been recorded.
        if (destination.visited && !destination.visits.length) {
            visits.push({ destination, title: destination.name, label: 'Date not recorded', type: 'visit', key: `${destination.id}:visited` });
        }
        destination.plans.forEach((plan, index) => plans.push({ destination, title: plan.title, date: plan.date,
            label: plan.date ? formatTravelDate(plan.date) : plan.timeframe || 'Someday', type: 'plan', key: `${destination.id}:plan:${index}` }));
    }
    return {
        visits: visits.sort((a, b) => (b.date ? dateValue(b.date) : -Infinity) - (a.date ? dateValue(a.date) : -Infinity)),
        upcoming: plans.filter(plan => plan.date).sort((a, b) => dateValue(a.date!) - dateValue(b.date!)),
        someday: plans.filter(plan => !plan.date),
    };
}

export interface ProjectedPoint { id: string; x: number; y: number }

/** Stable screen-space groups; behind-the-globe points are removed by the caller. */
export function clusterPoints<T extends ProjectedPoint>(points: T[], distance = 54): T[][] {
    const groups: T[][] = [];
    for (const point of points) {
        const group = groups.find(items => Math.hypot(items[0].x - point.x, items[0].y - point.y) < distance);
        if (group) group.push(point);
        else groups.push([point]);
    }
    return groups;
}

export function destinationUrl(id: string): string {
    return `/voyages/?destination=${encodeURIComponent(id)}`;
}
