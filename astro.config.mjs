// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
    site: 'https://zelaznogrihay.com', // Your domain name
    base: '/', // Use '/' if deploying to a custom domain
    output: 'static', // Generate static output
    build: {
        // Add cache busting for assets
        assets: 'assets-[hash]',
    },
    vite: {
        // Ensure HTML and data files aren't cached
        build: {
            rollupOptions: {
                output: {
                    entryFileNames: 'entry-[hash].js',
                    chunkFileNames: 'chunk-[hash].js',
                    assetFileNames: 'assets/[name]-[hash][extname]',
                },
            },
        },
    },
});
