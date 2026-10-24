import { geoOrthographic, type GeoProjection } from 'd3-geo';
import { getCountryStatus, type Destination } from './model.ts';

// Shared by the map and its key. Selection never changes a country's status color.
export const ATLAS_COLORS = {
    visited: '#10251a', wanted: '#badd9a', unvisited: '#8b9a82',
    ocean: '#68816f', border: '#526c55', selected: '#78ff28',
};

export function countryFill(destinations: Destination[], code: string): string {
    const status = getCountryStatus(destinations, code);
    return status.visited ? ATLAS_COLORS.visited : status.wanted ? ATLAS_COLORS.wanted : ATLAS_COLORS.unvisited;
}

export const wrapLongitude = (longitude: number) => ((longitude + 180) % 360 + 360) % 360 - 180;
export const shortestLongitude = (from: number, to: number) => from + wrapLongitude(to - from);

export function globeProjection(width: number, height: number, longitude: number, latitude: number, zoom = 1): GeoProjection {
    const radius = Math.min(width * .43, height * .44, 275) * zoom;
    return geoOrthographic().translate([width / 2, height / 2]).scale(radius)
        .rotate([-longitude, -latitude, 0]).clipAngle(90).precision(.4);
}

/** Canvas uses the same hemisphere test for drawing and pointer picking. */
export function globePoint(projection: GeoProjection, point: [number, number]): [number, number] | null {
    const [x, y] = projection.translate();
    if (Math.hypot(point[0] - x, point[1] - y) > projection.scale()) return null;
    const coordinates = projection.invert?.(point);
    return coordinates && coordinates.every(Number.isFinite) ? coordinates : null;
}
