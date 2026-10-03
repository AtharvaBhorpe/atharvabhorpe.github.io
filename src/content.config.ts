// https://docs.astro.build/en/guides/content-collections/
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '*.md' }),
  schema: z.object({
    title: z.string(), summary: z.string(), order: z.number(),
    objective: z.string(), outcome: z.string(), tools: z.string(), role: z.string(),
    image: z.string().optional(), imageAlt: z.string().optional(), caption: z.string().optional(),
    imageWidth: z.number().int().positive().optional(), imageHeight: z.number().int().positive().optional(),
    thumbnail: z.string().optional(), thumbnailAlt: z.string().optional(),
    demo: z.object({
      src: z.string(), poster: z.string(), sourceUrl: z.url(), description: z.string(),
      width: z.number().int().positive(), height: z.number().int().positive(),
    }).optional(),
    evidence: z.string().optional(),
    sources: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
  }),
});
export const collections = { projects };
