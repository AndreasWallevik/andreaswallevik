import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site = process.env.SITE_URL || 'https://example.com';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: 'https://andreaswallevik.no',
  base: '/',
  output: 'static',
  integrations: [sitemap()],
  vite: {
    server: {
      watch: {
        ignored: ['**/.tmp-*/**'],
      },
    },
  },
});

