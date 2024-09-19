import type { Loader } from "astro/loaders";
import { z } from "astro:content";
import { YOUTUBE_API_KEY, YOUTUBE_PLAYLIST_ID } from "astro:env/server";

export function youtubeLoader(): Loader {
  const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  url.searchParams.append("part", "snippet");
  url.searchParams.append("part", "contentDetails");
  url.searchParams.append("playlistId", YOUTUBE_PLAYLIST_ID);
  url.searchParams.append("key", YOUTUBE_API_KEY);
  // Max out page size to reduce number of requests
  url.searchParams.append("maxResults", "50");

  return {
    name: "youtube-loader",
    schema: videoSchema,
    load: async ({ store, parseData }) => {
      let nextPageToken: string | undefined;
      let pagesCollected = 0;

      await fetchVideos();
      while (nextPageToken) {
        await fetchVideos();
      }

      async function fetchVideos() {
        if (pagesCollected > 100) {
          console.warn(
            "Playlist contains over 5000 entries. Possible pagination loop detected.",
          );
        }
        nextPageToken && url.searchParams.set("pageToken", nextPageToken);
        const rawResponse = await fetch(url.href).then((res) => res.json());
        const response = youtubeApiResponse.parse(rawResponse);
        nextPageToken = response.nextPageToken;
        for (const item of response.items) {
          const id = item.snippet.resourceId.videoId;
          try {
            const data = await parseData({
              id,
              data: item,
            });
            store.set({ id, data });
          } catch (e) {
            console.warn(`Skipped video ${id}.`, e);
          }
        }
        pagesCollected++;
      }
    },
  };
}

const thumbnailSchema = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
});

const videoSchema = z
  .object({
    snippet: z.object({
      title: z.string(),
      description: z.string(),
      thumbnails: z.object({
        default: thumbnailSchema,
        medium: thumbnailSchema.optional(),
        high: thumbnailSchema.optional(),
      }),
      resourceId: z.object({
        videoId: z.string(),
      }),
    }),
    contentDetails: z.object({
      videoPublishedAt: z.coerce.date(),
    }),
  })
  .transform((item) => ({
    title: item.snippet.title,
    description: item.snippet.description,
    embedUrl: `https://www.youtube-nocookie.com/embed/${item.snippet.resourceId.videoId}?autoplay=1`,
    youtubeUrl: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}&list=${YOUTUBE_PLAYLIST_ID}`,
    publishedAt: item.contentDetails.videoPublishedAt,
    thumbnails: Object.entries(item.snippet.thumbnails)
      .map(([quality, thumbnail]) => {
        if (!thumbnail) return;
        return {
          quality,
          url: thumbnail.url,
          width: thumbnail.width,
          height: thumbnail.height,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  }));

// @see https://developers.google.com/youtube/v3/docs/search#resource
const youtubeApiResponse = z.object({
  nextPageToken: z.string().optional(),
  prevPageToken: z.string().optional(),
  items: z.array(
    z
      .object({
        snippet: z
          .object({
            resourceId: z.object({ videoId: z.string() }),
          })
          .passthrough(),
      })
      .passthrough(),
  ),
});
