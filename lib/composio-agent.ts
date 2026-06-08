import { Composio, SessionPreset } from "@composio/core";
import { createMCPClient } from "@ai-sdk/mcp";
import type { ToolkitToolPreferences } from "@/lib/tool-preferences";
import { getEnabledToolSlugs } from "@/lib/tool-preferences";
import { getToolkitAuthInfo } from "@/lib/composio-connect";
import { getComposioToolSlugsForToolkit } from "@/lib/composio-tools";
import { getComposioClient } from "@/lib/composio";

type ConnectedToolkit = {
  slug: string;
  noAuth: boolean;
};

type AgentToolkitConfig = {
  toolkits: string[];
  tools: Record<string, { enable: string[] }>;
};

async function getConnectedToolkits(userId: string): Promise<ConnectedToolkit[]> {
  const composio = getComposioClient();
  const connections = await composio.connectedAccounts.list({
    userIds: [userId],
    statuses: ["ACTIVE"],
    limit: 1000,
  });

  const toolkitMap = new Map<string, ConnectedToolkit>();

  for (const connection of connections.items) {
    toolkitMap.set(connection.toolkit.slug, {
      slug: connection.toolkit.slug,
      noAuth: false,
    });
  }

  return [...toolkitMap.values()];
}

async function getRecommendedToolSlugs(toolkitSlug: string): Promise<string[]> {
  try {
    const { recommendedToolSlugs } = await getComposioToolSlugsForToolkit(
      toolkitSlug
    );
    return recommendedToolSlugs;
  } catch {
    return [];
  }
}

async function getEligibleToolkitSlugs(
  connectedToolkits: ConnectedToolkit[],
  preferences: ToolkitToolPreferences[]
): Promise<string[]> {
  const composio = getComposioClient();
  const eligible = new Set(connectedToolkits.map((toolkit) => toolkit.slug));

  for (const preference of preferences) {
    if (eligible.has(preference.toolkitSlug)) {
      continue;
    }

    try {
      const toolkit = await composio.toolkits.get(preference.toolkitSlug);
      if (getToolkitAuthInfo(toolkit).noAuth) {
        eligible.add(preference.toolkitSlug);
      }
    } catch {
      // Ignore unknown or unavailable toolkits.
    }
  }

  return [...eligible];
}

export async function buildAgentToolkitConfig(
  preferences: ToolkitToolPreferences[],
  toolkitSlugs: string[]
): Promise<AgentToolkitConfig> {
  const tools: Record<string, { enable: string[] }> = {};
  const enabledToolkits: string[] = [];

  for (const toolkitSlug of toolkitSlugs) {
    const preference = preferences.find(
      (item) => item.toolkitSlug === toolkitSlug
    );
    const { allToolSlugs } = await getComposioToolSlugsForToolkit(toolkitSlug);
    const recommendedToolSlugs = preference?.initialized
      ? []
      : await getRecommendedToolSlugs(toolkitSlug);

    const enabledToolSlugs = getEnabledToolSlugs(
      allToolSlugs,
      preference,
      recommendedToolSlugs
    );

    if (enabledToolSlugs.length > 0) {
      tools[toolkitSlug] = { enable: enabledToolSlugs };
      enabledToolkits.push(toolkitSlug);
    }
  }

  return {
    toolkits: enabledToolkits,
    tools,
  };
}

export async function createComposioMcpClientForUser(
  userId: string,
  preferences: ToolkitToolPreferences[]
) {
  if (!process.env.COMPOSIO_API_KEY) {
    return null;
  }

  const composio = getComposioClient();
  const connectedToolkits = await getConnectedToolkits(userId);
  const toolkitSlugs = await getEligibleToolkitSlugs(
    connectedToolkits,
    preferences
  );

  if (toolkitSlugs.length === 0) {
    return null;
  }

  const config = await buildAgentToolkitConfig(preferences, toolkitSlugs);

  if (config.toolkits.length === 0) {
    return null;
  }

  const session = await composio.create(String(userId), {
    toolkits: { enable: config.toolkits },
    tools: config.tools,
    sessionPreset: SessionPreset.DIRECT_TOOLS,
  });

  const mcpClient = await createMCPClient({
    transport: {
      type: "http",
      url: session.mcp.url,
      headers: session.mcp.headers,
    },
  });

  const tools = await mcpClient.tools();
  const toolNames = Object.keys(tools);

  if (toolNames.length === 0) {
    await mcpClient.close();
    return null;
  }

  return {
    mcpClient,
    tools,
    enabledToolkits: config.toolkits,
    enabledToolCount: toolNames.length,
  };
}
