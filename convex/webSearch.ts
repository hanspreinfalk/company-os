"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";

type FirecrawlSearchResult = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
};

type FirecrawlSearchResponse = {
  success?: boolean;
  data?: {
    web?: FirecrawlSearchResult[];
  };
  error?: string;
};

const MAX_MARKDOWN_CHARS = 4000;

export const search = internalAction({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (_, { query, limit = 5 }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY is not configured");
    }

    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: Math.min(Math.max(limit, 1), 10),
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firecrawl search failed (${response.status}): ${errorText}`);
    }

    const payload = (await response.json()) as FirecrawlSearchResponse;
    const results = payload.data?.web ?? [];

    return results.map((result) => ({
      url: result.url,
      title: result.title ?? null,
      description: result.description ?? null,
      markdown: result.markdown
        ? result.markdown.slice(0, MAX_MARKDOWN_CHARS)
        : null,
    }));
  },
});
