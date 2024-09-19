import { z } from "astro:content";
import { YOUTUBE_API_KEY, YOUTUBE_PLAYLIST_ID } from "astro:env/server";

export const youtubeSchema = z.object({
  title: z.string(),
  description: z.string(),
  embedUrl: z.string(),
  youtubeUrl: z.string(),
  publishedAt: z.date(),
  thumbnails: z.array(
    z.object({
      quality: z.string(),
      url: z.string(),
      width: z.number(),
      height: z.number(),
    })
  ),
});

export async function youtubeLoader(): Promise<
  Array<z.infer<typeof youtubeSchema> & { id: string }>
> {
  const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  url.searchParams.append("part", "snippet");
  url.searchParams.append("part", "contentDetails");
  url.searchParams.append("playlistId", YOUTUBE_PLAYLIST_ID);
  url.searchParams.append("key", YOUTUBE_API_KEY);
  // Max out page size to reduce number of requests
  url.searchParams.append("maxResults", "50");

  let nextPageToken: string | undefined;
  const items: z.infer<typeof youtubeApiResponse>["items"] = [];
  let pagesCollected = 0;
  const rawResponse = await fetch(url).then((res) => res.json());
  const response = youtubeApiResponse.parse(rawResponse);
  nextPageToken = response.nextPageToken;
  items.push(...response.items);

  while (nextPageToken) {
    if (pagesCollected > 100) {
      console.warn(
        "Playlist contains over 5000 entries. Possible pagination loop detected."
      );
    }
    url.searchParams.set("pageToken", nextPageToken);
    const rawResponse = await fetch(url.href).then((res) => res.json());
    const response = youtubeApiResponse.parse(rawResponse);
    nextPageToken = response.nextPageToken;
    items.push(...response.items);
    pagesCollected++;
  }

  const mappedItems = items
    .filter(
      (item): item is z.infer<typeof videoSchema> =>
        item.snippet.title !== "Deleted video" &&
        item.snippet.title !== "Private video"
    )
    .sort(
      (a, b) =>
        b.contentDetails.videoPublishedAt.getTime() -
        a.contentDetails.videoPublishedAt.getTime()
    )
    .map((item) => {
      return {
        id: item.snippet.resourceId.videoId,
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
      };
    });

  return mappedItems;
}

const thumbnailResponse = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
});

const deletedVideoSchema = z.object({
  snippet: z.object({
    title: z.literal("Deleted video"),
  }),
});

const privateVideoSchema = z.object({
  snippet: z.object({
    title: z.literal("Private video"),
  }),
});

const videoSchema = z.object({
  snippet: z.object({
    title: z.string(),
    description: z.string(),
    thumbnails: z.object({
      default: thumbnailResponse,
      medium: thumbnailResponse.optional(),
      high: thumbnailResponse.optional(),
    }),
    resourceId: z.object({
      videoId: z.string(),
    }),
  }),
  contentDetails: z.object({
    videoPublishedAt: z.coerce.date(),
  }),
});

// @see https://developers.google.com/youtube/v3/docs/search#resource
const youtubeApiResponse = z.object({
  nextPageToken: z.string().optional(),
  prevPageToken: z.string().optional(),
  items: z.array(deletedVideoSchema.or(privateVideoSchema).or(videoSchema)),
});
