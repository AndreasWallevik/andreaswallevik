import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { isOfficialMusicEmbedUrl } from './lib/music-player';

const category = z.enum(['music', 'film-visuals', 'sound-for-visuals', 'experiments']);
const link = z.object({ label: z.string().min(1), url: z.url() });
const player = z.object({
  provider: z.enum(['spotify', 'soundcloud']),
  embedUrl: z.url(),
}).refine((entry) => isOfficialMusicEmbedUrl(entry.provider, entry.embedUrl), {
  message: 'Use an official HTTPS Spotify or SoundCloud embed URL without autoplay.',
  path: ['embedUrl'],
});
const video = z.object({
  provider: z.enum(['youtube', 'vimeo']),
  id: z.string().min(1),
  url: z.url(),
  embed: z.boolean().default(true),
}).refine((entry) => {
  const url = new URL(entry.url);
  if (url.protocol !== 'https:') return false;
  if (entry.provider === 'youtube') {
    return (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') &&
      url.pathname === '/watch' && url.searchParams.get('v') === entry.id &&
      /^[A-Za-z0-9_-]{11}$/.test(entry.id);
  }
  return (url.hostname === 'vimeo.com' || url.hostname === 'www.vimeo.com') &&
    url.pathname === `/${entry.id}` && /^\d+$/.test(entry.id);
}, { message: 'Use an official HTTPS YouTube or Vimeo URL matching the video ID.', path: ['url'] });

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: ({ image }) => z.object({
    title: z.string().min(1),
    artistOrClient: z.string().min(1).optional(),
    subtitle: z.string().optional(),
    description: z.string().min(1).optional(),
    categories: z.array(category).min(1),
    year: z.number().int().min(1900).max(2100).optional(),
    releaseDate: z.coerce.date().optional(),
    featured: z.boolean().default(false),
    showInProjects: z.boolean().default(false),
    showInVisualWork: z.boolean().default(false),
    visualOrder: z.number().int().positive().optional(),
    draft: z.boolean().default(true),
    detail: z.boolean().default(true),
    cover: z.union([z.string().startsWith('/images/'), image()]).optional(),
    coverAlt: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    collaborators: z.array(z.string()).default([]),
    roles: z.array(z.string()).default([]),
    credits: z.array(z.object({ role: z.string().min(1), names: z.array(z.string().min(1)).min(1) })).default([]),
    relatedTo: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
    links: z.array(link).default([]),
    player: player.optional(),
    video: video.optional(),
    gallery: z.array(z.object({ src: z.string().startsWith('/images/'), alt: z.string().min(1) })).default([]),
    embeds: z.array(z.object({
      provider: z.enum(['youtube', 'vimeo', 'spotify', 'soundcloud']),
      id: z.string().min(1),
      label: z.string().min(1),
      poster: z.string().startsWith('/images/').optional(),
    })).default([]),
  }).superRefine((entry, context) => {
    if (!entry.draft && !entry.video && (!entry.cover || !entry.coverAlt)) {
      context.addIssue({ code: 'custom', path: ['cover'], message: 'Published entries need artwork and alt text, or a video.' });
    }
    if (!entry.draft && entry.cover && !entry.coverAlt) {
      context.addIssue({ code: 'custom', path: ['coverAlt'], message: 'Published artwork needs alt text.' });
    }
    if (entry.showInVisualWork && !entry.video) {
      context.addIssue({ code: 'custom', path: ['video'], message: 'Visual Work entries need a YouTube or Vimeo video.' });
    }
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({ title: z.string(), description: z.string() }),
});

export const collections = { projects, pages };
