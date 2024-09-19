import { defineCollection, reference, z } from "astro:content";
import { youtubeLoader, youtubeSchema } from "./youtube-loader";
import { glob } from "astro/loaders";

const videos = defineCollection({
  loader: youtubeLoader,
  schema: youtubeSchema,
});

const announcements = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/announcements/" }),
  schema: z.object({
    title: z.string(),
    videos: z.array(reference("videos")),
  }),
});

export const collections = { videos, announcements };
