import { geoOrthographic, type GeoProjection } from 'd3-geo';
import type { LineString } from 'geojson';
import { getCountryStatus, type Coordinates, type Destination } from './model.ts';

// Shared by the map and its key. Selection never changes a country's status color.
export const ATLAS_COLORS = {
    visited: '#10251a', wanted: '#badd9a', unvisited: '#8b9a82',
    ocean: '#68816f', border: '#526c55', selected: '#78ff28',
};

export const STATE_COLORS = { visited: '#294b33', other: ATLAS_COLORS.visited, border: '#42624a' };

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

type Vector = [number, number, number];
const radians = Math.PI / 180;
const vector = ({lat, lng}: Coordinates): Vector => [Math.cos(lat*radians)*Math.cos(lng*radians), Math.cos(lat*radians)*Math.sin(lng*radians), Math.sin(lat*radians)];
const distance = (a: Vector, b: Vector) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
const reflect = (a: Vector, b: Vector): Vector => [2*a[0]-b[0], 2*a[1]-b[1], 2*a[2]-b[2]];
const blend = (a: Vector, b: Vector, start: number, end: number, time: number): Vector => {
    const weight = (time-start)/(end-start);
    return [a[0]+(b[0]-a[0])*weight, a[1]+(b[1]-a[1])*weight, a[2]+(b[2]-a[2])*weight];
};

/** A single centripetal Catmull–Rom curve through the recorded stops, sampled
 * on the unit sphere once. The geographic projection still clips the horizon;
 * camera movement never refits the curve or changes its shape between frames. */
export function smoothRouteGeometry(stops: Coordinates[]): LineString {
    const points: { position: Coordinates; point: Vector }[] = [];
    for (const position of stops) {
        const point = vector(position);
        if (!points.length || distance(points[points.length-1].point, point)>1e-8) points.push({position, point});
    }
    if (points.length<2) {
        const point = points[0]?.position;
        return {type:'LineString', coordinates:point ? [[point.lng,point.lat],[point.lng,point.lat]] : []};
    }
    const coordinates: [number,number][] = [];
    for (let index=0; index<points.length-1; index++) {
        const p1=points[index].point, p2=points[index+1].point;
        const p0=points[index-1]?.point || reflect(p1,p2);
        const p3=points[index+2]?.point || reflect(p2,p1);
        const t0=0, t1=Math.sqrt(distance(p0,p1)), t2=t1+Math.sqrt(distance(p1,p2)), t3=t2+Math.sqrt(distance(p2,p3));
        const samples=Math.max(128,Math.min(512,Math.ceil(distance(p1,p2)/radians*12)));
        for (let step=index===0?0:1; step<=samples; step++) {
            if(step===0 || step===samples) {
                const {position}=points[step===0?index:index+1]; coordinates.push([position.lng,position.lat]); continue;
            }
            // Denser samples at joins keep tight turns smooth even where a
            // short city hop meets a much longer onward leg.
            const u=(1-Math.cos(Math.PI*step/samples))/2;
            const time=t1+(t2-t1)*u;
            const a1=blend(p0,p1,t0,t1,time), a2=blend(p1,p2,t1,t2,time), a3=blend(p2,p3,t2,t3,time);
            const b1=blend(a1,a2,t0,t2,time), b2=blend(a2,a3,t1,t3,time);
            const point=blend(b1,b2,t1,t2,time);
            coordinates.push([Math.atan2(point[1],point[0])/radians, Math.atan2(point[2],Math.hypot(point[0],point[1]))/radians]);
        }
    }
    return {type:'LineString', coordinates};
}
