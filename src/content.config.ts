import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { createDestinationSchema } from './lib/voyages/schema';

const blog = defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        pubDate: z.coerce.date(),
    }),
});

const voyages = defineCollection({
    loader: glob({ pattern: '**/index.md', base: './src/content/voyages', generateId: ({ entry }) => entry.replace(/\/index\.md$/, '') }),
    schema: ({ image }) => createDestinationSchema(image()),
});

export const collections = { blog, voyages };
