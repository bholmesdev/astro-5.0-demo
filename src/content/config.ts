import { defineCollection, z } from "astro:content";
import { youtubeLoader, youtubeSchema } from "./youtube-loader";

const videos = defineCollection({
  loader: youtubeLoader,
  schema: youtubeSchema,
});

export const collections = { videos };
