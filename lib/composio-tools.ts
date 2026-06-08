import type { ConnectorTool } from "@/lib/composio-types";

const COMPOSIO_API_BASE_URL = "https://backend.composio.dev";

type ComposioRawTool = {
  slug: string;
  name: string;
  description?: string | null;
  tags?: string[] | null;
  no_auth?: boolean;
  toolkit?: { slug?: string; name?: string };
};

export type ListComposioToolsOptions = {
  toolkitSlug: string;
  search?: string;
  limit?: number;
};

function mapRawTool(
  tool: ComposioRawTool,
  toolkitSlug: string,
  recommendedSlugs: Set<string>
): ConnectorTool {
  return {
    slug: tool.slug,
    name: tool.name,
    description: tool.description ?? "",
    tags: tool.tags ?? [],
    noAuth: tool.no_auth ?? false,
    recommended: recommendedSlugs.has(tool.slug),
    toolkitSlug: tool.toolkit?.slug ?? toolkitSlug,
    toolkitName: tool.toolkit?.name ?? toolkitSlug,
  };
}

async function fetchRawToolkitTools(
  toolkitSlug: string,
  options?: { search?: string; important?: boolean; limit?: number }
): Promise<ComposioRawTool[]> {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "COMPOSIO_API_KEY is not set. Add it to your .env.local file."
    );
  }

  const params = new URLSearchParams({
    toolkit_slug: toolkitSlug,
    limit: String(options?.limit ?? 1000),
    toolkit_versions: "latest",
  });

  if (options?.search) {
    params.set("search", options.search);
  }

  if (options?.important) {
    params.set("important", "true");
  }

  const response = await fetch(
    `${COMPOSIO_API_BASE_URL}/api/v3/tools?${params.toString()}`,
    {
      headers: {
        "x-api-key": apiKey,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch Composio tools (${response.status}): ${errorText}`
    );
  }

  const payload = (await response.json()) as { items?: ComposioRawTool[] };
  return payload.items ?? [];
}

export async function listComposioToolsForToolkit(
  options: ListComposioToolsOptions
): Promise<{ tools: ConnectorTool[]; recommendedToolSlugs: string[] }> {
  const items = await fetchRawToolkitTools(options.toolkitSlug, {
    search: options.search,
    limit: options.limit,
  });

  let recommendedSlugs = new Set<string>();

  if (!options.search?.trim()) {
    const recommendedItems = await fetchRawToolkitTools(options.toolkitSlug, {
      limit: options.limit,
      important: true,
    });
    recommendedSlugs = new Set(recommendedItems.map((tool) => tool.slug));

    // Some toolkits (e.g. Granola MCP) have no "important" tools in Composio.
    // In that case, treat every tool as the recommended default set.
    if (recommendedSlugs.size === 0) {
      recommendedSlugs = new Set(items.map((tool) => tool.slug));
    }
  }

  const tools = items.map((tool) =>
    mapRawTool(tool, options.toolkitSlug, recommendedSlugs)
  );

  return {
    tools,
    recommendedToolSlugs: [...recommendedSlugs],
  };
}

export async function getComposioToolSlugsForToolkit(
  toolkitSlug: string
): Promise<{ allToolSlugs: string[]; recommendedToolSlugs: string[] }> {
  const { tools, recommendedToolSlugs } = await listComposioToolsForToolkit({
    toolkitSlug,
  });

  return {
    allToolSlugs: tools.map((tool) => tool.slug),
    recommendedToolSlugs,
  };
}
