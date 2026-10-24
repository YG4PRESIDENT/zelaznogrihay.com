# Website hosting

The full Astro site is deployed to Cloudflare Workers Static Assets as `zelaznogrihay`, in the owner's Cloudflare account. `wrangler.jsonc` is the deployment configuration. Both the personal domain and `www` route to this Worker; the existing proxied DNS records stay in place.

Run `npm run deploy` to build, test, type-check, and publish an update. Authentication comes from the local Wrangler login; credentials never belong in the repository. `https://zelaznogrihay.yahirg2021.workers.dev` serves the same deployed version.

Run `npm run preview:cloudflare` to upload a version for visual review at `https://voyages-zelaznogrihay.yahirg2021.workers.dev`. This alias serves the uploaded version without changing production traffic. Version URLs are enabled in Wrangler configuration; all content in this static site is public.

The GitHub workflow checks source changes; production hosting is Cloudflare, with publication through the deployment command. The old GitHub Pages origin remains available as a fallback. Removing this Worker's two domain routes restores traffic to that origin without a DNS change.

Voyages uses one inline destination list. Country entries may set `experience: passed-through` or `experience: lived`. The United States entry contains the states supplied by the owner; airport stops count and may have a `stop` coordinate for a small globe dot. The New York stop is shown at city level until a specific airport is provided.

The atlas has a local paper palette; other pages retain the site's existing theme. The globe uses Canvas with a spherical orthographic projection. It turns gently until paused or interacted with, respects reduced motion, and stops rendering when hidden or offscreen. US state geometry loads only when the US is selected. Airport-only state visits have dots rather than filled state shapes.
