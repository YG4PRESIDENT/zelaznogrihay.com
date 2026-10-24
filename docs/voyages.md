# Adding to Voyages

Tell Codex the destination, what you want to record, and the folder containing your photos. For example:

> Add a place to Voyages. Here is its name, when I visited, a few memories, and the photo folder. I also want to go back for these things.

One destination entry drives the globe, country highlights, gallery, and destination list. You can start with just a country or a wish and fill in the rest later. Existing entries live in `src/content/voyages/<destination-id>/index.md`. The folder name is its permanent ID and shareable link: `/voyages/?destination=<destination-id>`.

## A future country trip

```yaml
---
name: Japan
kind: country
countryCodes: [JP]
plans:
  - title: Cherry blossoms in Japan with wife
    timeframe: Someday in spring
    thingsToDo:
      - Add the experiences I want to have
    gettingThere: Add my own transportation notes when I have them.
    links:
      - label: A useful reference
        url: https://example.com
---

Write any longer notes here in Markdown.
```

Remove optional fields until you have something to put in them. There is no need to fill out a form's worth of metadata.

## Recording a specific place and photos

Copy this structure into a new destination folder and replace the example fields with real details. Keep the photos beside the entry; JPEG, PNG, WebP, and AVIF work with the image pipeline. Codex can convert HEIC photos when adding them.

```yaml
---
name: The place's name
kind: place
countryCodes: [JP]
coordinates: { lat: 35, lng: 139 }
summary: A short introduction in my own words.
visits:
  - id: first-visit
    date: '2025-04'
    memories: What I remember about being here.
photos:
  - src: ./photos/first-photo.jpg
    alt: Describe what this photograph shows.
    caption: The story behind this moment.
    visit: first-visit
    cover: true
---

Longer memories, lists, and links go here.
```

The coordinates above are illustrative: use the actual place's location. Photos are optimized at build time into small thumbnails and larger gallery images. Choose one cover photo; the first image is used if none is selected. `visit` associates a photo with a visit and is optional.

## Countries, regions, and dates

- `country`: use an ISO alpha-2 code, such as `TR`, `JP`, or `BR`. Its label and focus come from the geography index. Add `visited: true` to record a visited country before adding specific trips.
- `place`: add its country code and precise `coordinates`. This creates a place pin; photos turn it into a camera pin and a thumbnail at closer zoom.
- `region`: use an optional `focus: { lat, lng }` to frame a broad area. This is a region label, not a claim that a trip happened at those exact coordinates.
- `idea`: an unplaced wish. Keep it without coordinates or country codes until its location is known.
- Use quoted `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` dates, preserving the precision you actually know. A visit can have `endDate`. A plan can have a target `date` and/or a free-form `timeframe`.
- Add another item to `visits` for a return trip and another item to `plans` for a future wish. A place may be both visited and on the wishlist.

Visited `region` and `place` entries with a matching country code appear inside that country's expanded row. Add a country entry when recording the first region in a new country. Each region or place keeps its own notes, visits, photos, and link. A region spanning multiple recorded countries appears beneath the first matching country; other ungrouped regions remain visible in the list. No location is inferred from a country visit.

The US row contains the recorded states. Selecting it reveals state boundaries; selecting a state name frames that region. Airport stops stay as small dots. The map key uses dark ink for visited countries, pale gold for future countries, and sage for countries not yet visited. A country with both past visits and future plans keeps its visited color.

Country counts deduplicate countries across all visited entries. Antarctica is a region and does not increase the visited-country count. Undated visits and plans stay undated.

## Check and publish

Run `npm test`, `npm run check:voyages`, and `npm run build`. Use `npm run dev` to review the atlas. Publish to Cloudflare with `npm run deploy`; travel updates need no external database or map key. See [Cloudflare hosting](cloudflare.md).

## Geography

Country outlines are the public-domain Natural Earth 1:50m Admin 0 country data, downloaded from [the Natural Earth repository](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson). A build-time Mapshaper pass retains 7% of removable vertices, shared boundaries, and every country, including small countries. US states use the same source's Admin 1 outlines, simplified to 12%. Coordinates are rounded to 0.001 degrees and spherical winding is normalized for D3.

Regenerate outlines and browsing indexes with `npm run sync:geography`; for offline use, pass country and state GeoJSON files as the first and second arguments to `node scripts/sync-voyages-geography.mjs`. Geography is served locally; visitors never fetch it from a third party. Country geometry loads with the lightweight globe; state geometry is a separate request on US selection.
