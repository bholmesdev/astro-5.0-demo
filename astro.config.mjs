// @ts-check
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  env: {
    schema: {
      YOUTUBE_API_KEY: envField.string({
        context: "server",
        access: "secret",
      }),
      YOUTUBE_PLAYLIST_ID: envField.string({
        context: "server",
        access: "public",
      }),
    },
  },
});
