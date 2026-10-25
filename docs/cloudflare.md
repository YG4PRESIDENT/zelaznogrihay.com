# Website hosting

The full Astro site is deployed to Cloudflare Workers Static Assets as `zelaznogrihay`, in the owner's Cloudflare account. `wrangler.jsonc` is the deployment configuration. Both the personal domain and `www` route to this Worker; the existing proxied DNS records stay in place.

Run `npm run deploy` to build, test, type-check, and publish an update. Authentication comes from the local Wrangler login; credentials never belong in the repository. `https://zelaznogrihay.yahirg2021.workers.dev` serves the same deployed version.

Run `npm run preview:cloudflare` to upload a version for visual review at `https://voyages-zelaznogrihay.yahirg2021.workers.dev`. This alias serves the uploaded version without changing production traffic. Version URLs are enabled in Wrangler configuration; all content in this static site is public.

The GitHub workflow checks source changes; production hosting is Cloudflare, with publication through the deployment command. The old GitHub Pages origin remains available as a fallback. Removing this Worker's two domain routes restores traffic to that origin without a DNS change.

Voyages uses one inline destination list. Country entries may set `experience: passed-through` or `experience: lived`. The United States source retains the supplied state history. Airport-only entries are excluded from the public visited-state list/count and never receive a visited-state highlight. The published list has 17 states; New York and Ohio remain unhighlighted. Public state entries use state-center coordinates; airport coordinates and airport labels are omitted.

Voyages inherits the same dark theme, monospace type, green accents, and dividers as the rest of the site. A centered globe sits above two attached columns: visited countries on the left and future destinations on the right. The columns stack at 680px and below. There is no visible page header, experience badge, helper caption, or rotation button; the key and 44px zoom controls remain. Selecting a country labels it on the globe and expands its regions in the visited column.

The globe uses Canvas with a spherical orthographic projection. Its opening turn lasts at most 3.5 seconds of visible time and stops on interaction. Reduced motion skips the turn and camera springs. Hidden or offscreen maps stop rendering. US state geometry loads only when the US is selected, with a subtle lighter fill for visited states. Recorded itineraries use a single smooth, continuous spherical curve through the recorded stops. China has city points without an inferred itinerary order.
