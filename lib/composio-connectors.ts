import {
  asToolkitLike,
  getToolkitAuthInfo,
  requiresAuthConfigCredentials,
  requiresCustomAuth,
} from "@/lib/composio-connect";
import { getComposioClient } from "@/lib/composio";
import type { Connector } from "@/lib/composio-types";

const COMPOSIO_API_BASE_URL = "https://backend.composio.dev";
const DEFAULT_PAGE_SIZE = 30;

type ComposioToolkitListItem = {
  slug: string;
  name: string;
  meta?: {
    description?: string | null;
    logo?: string | null;
    app_url?: string | null;
    tools_count?: number | null;
    triggers_count?: number | null;
    categories?: Array<{ id?: string; slug?: string; name: string }>;
  };
  auth_schemes?: string[];
  composio_managed_auth_schemes?: string[];
  no_auth?: boolean;
  auth_config_details?: Array<{ mode: string }>;
};

type ComposioToolkitListResponse = {
  items?: ComposioToolkitListItem[];
  next_cursor?: string | null;
  total_pages?: number;
};

export type ListComposioConnectorsOptions = {
  limit?: number;
  cursor?: string;
  search?: string;
};

export type ListComposioConnectorsResult = {
  connectors: Connector[];
  nextCursor: string | null;
  hasMore: boolean;
  totalPages: number | null;
};

function mapToolkitToConnector(toolkit: ComposioToolkitListItem): Connector {
  const toolkitAuth = asToolkitLike({
    name: toolkit.name,
    authConfigDetails: toolkit.auth_config_details?.map((detail) => ({
      mode: detail.mode,
    })),
    composioManagedAuthSchemes: toolkit.composio_managed_auth_schemes,
    noAuth: toolkit.no_auth,
    authSchemes: toolkit.auth_schemes,
  });
  const authInfo = getToolkitAuthInfo(toolkitAuth);

  return {
    slug: toolkit.slug,
    name: toolkit.name,
    description: toolkit.meta?.description ?? undefined,
    logo: toolkit.meta?.logo ?? undefined,
    appUrl: toolkit.meta?.app_url ?? undefined,
    toolsCount: toolkit.meta?.tools_count ?? undefined,
    triggersCount: toolkit.meta?.triggers_count ?? undefined,
    categories: toolkit.meta?.categories?.map((category) => ({
      slug: category.slug ?? category.id ?? category.name,
      name: category.name,
    })),
    noAuth: authInfo.noAuth,
    authSchemes: authInfo.authSchemes,
    requiresCustomAuth: requiresCustomAuth(toolkitAuth),
    requiresAuthConfigCredentials: requiresAuthConfigCredentials(toolkitAuth),
  };
}

function mapRetrievedToolkitToConnector(toolkit: {
  slug: string;
  name: string;
  meta: {
    description?: string;
    logo?: string;
    appUrl?: string;
    toolsCount?: number;
    triggersCount?: number;
    categories?: Array<{ slug: string; name: string }>;
  };
}): Connector {
  const toolkitAuth = asToolkitLike(toolkit);
  const authInfo = getToolkitAuthInfo(toolkitAuth);

  return {
    slug: toolkit.slug,
    name: toolkit.name,
    description: toolkit.meta.description,
    logo: toolkit.meta.logo,
    appUrl: toolkit.meta.appUrl,
    toolsCount: toolkit.meta.toolsCount,
    triggersCount: toolkit.meta.triggersCount,
    categories: toolkit.meta.categories,
    noAuth: authInfo.noAuth,
    authSchemes: authInfo.authSchemes,
    requiresCustomAuth: requiresCustomAuth(toolkitAuth),
    requiresAuthConfigCredentials: requiresAuthConfigCredentials(toolkitAuth),
  };
}

async function fetchToolkitList(
  options: ListComposioConnectorsOptions
): Promise<ComposioToolkitListResponse> {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "COMPOSIO_API_KEY is not set. Add it to your .env.local file."
    );
  }

  const params = new URLSearchParams({
    limit: String(options.limit ?? DEFAULT_PAGE_SIZE),
    sort_by: "alphabetically",
  });

  if (options.cursor) {
    params.set("cursor", options.cursor);
  }

  if (options.search?.trim()) {
    params.set("search", options.search.trim());
  }

  const response = await fetch(
    `${COMPOSIO_API_BASE_URL}/api/v3/toolkits?${params.toString()}`,
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
      `Failed to fetch Composio connectors (${response.status}): ${errorText}`
    );
  }

  return (await response.json()) as ComposioToolkitListResponse;
}

export async function listComposioConnectors(
  options: ListComposioConnectorsOptions = {}
): Promise<ListComposioConnectorsResult> {
  const payload = await fetchToolkitList(options);
  const items = payload.items ?? [];
  const nextCursor = payload.next_cursor ?? null;

  return {
    connectors: items.map(mapToolkitToConnector),
    nextCursor,
    hasMore: Boolean(nextCursor),
    totalPages: payload.total_pages ?? null,
  };
}

export async function getComposioConnectorBySlug(
  slug: string
): Promise<Connector | null> {
  const composio = getComposioClient();

  try {
    const toolkit = await composio.toolkits.get(slug);
    return mapRetrievedToolkitToConnector(toolkit);
  } catch {
    return null;
  }
}

export const CONNECTORS_PAGE_SIZE = DEFAULT_PAGE_SIZE;
