"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AuthField,
  Connector,
  ConnectorTool,
  ServiceConnection,
} from "@/lib/composio-types";
import {
  countEnabledTools,
  getToolkitPreference,
  isPreferenceInitialized,
  isToolEnabled,
} from "@/lib/tool-preferences";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  CheckCircle2,
  Link2,
  Loader2,
  Plug,
  Search,
  Unlink,
  Wrench,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";

type ConnectionMap = Record<string, ServiceConnection[]>;

function groupConnectionsByToolkit(
  connections: ServiceConnection[]
): ConnectionMap {
  return connections.reduce<ConnectionMap>((groups, connection) => {
    const existing = groups[connection.toolkitSlug] ?? [];
    groups[connection.toolkitSlug] = [...existing, connection];
    return groups;
  }, {});
}

function getActiveConnection(
  connections: ServiceConnection[] | undefined
): ServiceConnection | undefined {
  return connections?.find((connection) => connection.status === "ACTIVE");
}

function isOAuthConnector(connector: Connector) {
  if (connector.noAuth) {
    return false;
  }

  return (connector.authSchemes ?? []).some((scheme) =>
    ["OAUTH1", "OAUTH2", "DCR_OAUTH"].includes(scheme)
  );
}

function requiresCredentials(connector: Connector) {
  if (connector.noAuth) {
    return false;
  }

  return !isOAuthConnector(connector);
}

type ToolFilter = "all" | "enabled" | "disabled";

const CONNECTORS_PAGE_SIZE = 30;
const CONNECTOR_SEARCH_DEBOUNCE_MS = 300;

type ConnectorsListResponse = {
  connectors?: Connector[];
  nextCursor?: string | null;
  hasMore?: boolean;
  totalPages?: number | null;
  error?: string;
};

export function ConnectorsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connectorsNextCursor, setConnectorsNextCursor] = useState<
    string | null
  >(null);
  const [connectorsHasMore, setConnectorsHasMore] = useState(false);
  const [connectorsTotalPages, setConnectorsTotalPages] = useState<number | null>(
    null
  );
  const [connections, setConnections] = useState<ServiceConnection[]>([]);
  const [connectorsLoading, setConnectorsLoading] = useState(true);
  const [connectorsLoadingMore, setConnectorsLoadingMore] = useState(false);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [connectorsError, setConnectorsError] = useState<string | null>(null);
  const [connectorSearch, setConnectorSearch] = useState("");
  const [debouncedConnectorSearch, setDebouncedConnectorSearch] = useState("");
  const [connectorLookup, setConnectorLookup] = useState<
    Record<string, Connector>
  >({});
  const connectorLookupRef = useRef(connectorLookup);
  connectorLookupRef.current = connectorLookup;
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [tools, setTools] = useState<ConnectorTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [toolSearch, setToolSearch] = useState("");
  const [connectingSlug, setConnectingSlug] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [credentialsConnector, setCredentialsConnector] =
    useState<Connector | null>(null);
  const [authFields, setAuthFields] = useState<AuthField[]>([]);
  const [authFieldsPurpose, setAuthFieldsPurpose] = useState<
    "connection" | "auth_config"
  >("connection");
  const [authFieldsLoading, setAuthFieldsLoading] = useState(false);
  const [credentialValues, setCredentialValues] = useState<
    Record<string, string>
  >({});
  const [toolFilter, setToolFilter] = useState<ToolFilter>("all");
  const [togglingToolSlug, setTogglingToolSlug] = useState<string | null>(null);
  const [bulkUpdatingTools, setBulkUpdatingTools] = useState(false);
  const [recommendedToolSlugs, setRecommendedToolSlugs] = useState<string[]>([]);

  const toolPreferences = useQuery(api.connectorTools.getToolPreferences, {});
  const setToolEnabledMutation = useMutation(api.connectorTools.setToolEnabled);
  const setToolkitToolsEnabledMutation = useMutation(
    api.connectorTools.setToolkitToolsEnabled
  );
  const initializeToolkitPreferencesMutation = useMutation(
    api.connectorTools.initializeToolkitPreferences
  );

  const connectionsByToolkit = useMemo(
    () => groupConnectionsByToolkit(connections),
    [connections]
  );

  const upsertConnectorLookup = useCallback((items: Connector[]) => {
    if (items.length === 0) {
      return;
    }

    setConnectorLookup((current) => {
      const next = { ...current };
      for (const connector of items) {
        next[connector.slug] = connector;
      }
      return next;
    });
  }, []);

  const fetchConnectorBySlug = useCallback(
    async (slug: string): Promise<Connector | null> => {
      const cached = connectorLookupRef.current[slug];
      if (cached) {
        return cached;
      }

      try {
        const response = await fetch(
          `/api/connectors?slug=${encodeURIComponent(slug)}`
        );
        const data = (await response.json()) as {
          connector?: Connector;
          error?: string;
        };

        if (!response.ok || !data.connector) {
          return null;
        }

        upsertConnectorLookup([data.connector]);
        return data.connector;
      } catch {
        return null;
      }
    },
    [upsertConnectorLookup]
  );

  const loadConnectorsPage = useCallback(
    async ({
      cursor,
      search,
      append = false,
    }: {
      cursor?: string;
      search?: string;
      append?: boolean;
    }) => {
      if (append) {
        setConnectorsLoadingMore(true);
      } else {
        setConnectorsLoading(true);
        setConnectorsError(null);
      }

      try {
        const params = new URLSearchParams({
          limit: String(CONNECTORS_PAGE_SIZE),
        });

        if (cursor) {
          params.set("cursor", cursor);
        }

        if (search?.trim()) {
          params.set("search", search.trim());
        }

        const response = await fetch(`/api/connectors?${params.toString()}`);
        const data = (await response.json()) as ConnectorsListResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load connectors");
        }

        const page = data.connectors ?? [];
        upsertConnectorLookup(page);
        setConnectors((current) => (append ? [...current, ...page] : page));
        setConnectorsNextCursor(data.nextCursor ?? null);
        setConnectorsHasMore(Boolean(data.hasMore));
        setConnectorsTotalPages(data.totalPages ?? null);
      } catch (error) {
        if (!append) {
          setConnectors([]);
          setConnectorsError(
            error instanceof Error ? error.message : "Failed to load connectors"
          );
        } else {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to load more connectors"
          );
        }
      } finally {
        if (append) {
          setConnectorsLoadingMore(false);
        } else {
          setConnectorsLoading(false);
        }
      }
    },
    [upsertConnectorLookup]
  );

  const loadConnections = useCallback(async () => {
    setConnectionsLoading(true);

    try {
      const response = await fetch("/api/connectors/connections");
      const data = (await response.json()) as {
        connections?: ServiceConnection[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load connections");
      }

      setConnections(data.connections ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load connections"
      );
    } finally {
      setConnectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedConnectorSearch(connectorSearch);
    }, CONNECTOR_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [connectorSearch]);

  useEffect(() => {
    void loadConnectorsPage({ search: debouncedConnectorSearch });
  }, [debouncedConnectorSearch, loadConnectorsPage]);

  useEffect(() => {
    const activeConnections = connections.filter(
      (connection) => connection.status === "ACTIVE"
    );

    for (const connection of activeConnections) {
      if (!connectorLookupRef.current[connection.toolkitSlug]) {
        void fetchConnectorBySlug(connection.toolkitSlug);
      }
    }
  }, [connections, fetchConnectorBySlug]);

  useEffect(() => {
    const connectedToolkit = searchParams.get("connected");
    if (!connectedToolkit) {
      return;
    }

    void loadConnections().then(() => {
      setSelectedSlug(connectedToolkit);
      toast.success("Connection flow completed. Refreshing status...");
      router.replace("/connectors");
    });
  }, [searchParams, loadConnections, router]);

  const selectedConnector = useMemo(() => {
    if (!selectedSlug) {
      return null;
    }

    return (
      connectors.find((connector) => connector.slug === selectedSlug) ??
      connectorLookup[selectedSlug] ??
      null
    );
  }, [connectors, connectorLookup, selectedSlug]);

  useEffect(() => {
    if (!selectedSlug || selectedConnector) {
      return;
    }

    void fetchConnectorBySlug(selectedSlug);
  }, [fetchConnectorBySlug, selectedConnector, selectedSlug]);

  const selectedConnections = selectedSlug
    ? connectionsByToolkit[selectedSlug]
    : undefined;

  const activeConnection = getActiveConnection(selectedConnections);

  const selectedPreference = useMemo(
    () => getToolkitPreference(toolPreferences, selectedSlug ?? ""),
    [toolPreferences, selectedSlug]
  );

  const enabledToolCount = useMemo(
    () =>
      countEnabledTools(
        tools.map((tool) => tool.slug),
        selectedPreference,
        recommendedToolSlugs
      ),
    [tools, selectedPreference, recommendedToolSlugs]
  );

  const connectedServices = useMemo(() => {
    return connections
      .filter((connection) => connection.status === "ACTIVE")
      .map((connection) => ({
        connection,
        connector: connectorLookup[connection.toolkitSlug],
      }));
  }, [connections, connectorLookup]);

  const connectorCountLabel = useMemo(() => {
    if (connectorsLoading && connectors.length === 0) {
      return null;
    }

    if (debouncedConnectorSearch.trim()) {
      return connectorsHasMore
        ? `${connectors.length}+ results`
        : `${connectors.length} result${connectors.length === 1 ? "" : "s"}`;
    }

    if (connectorsTotalPages) {
      const approximateTotal = connectorsTotalPages * CONNECTORS_PAGE_SIZE;
      return connectorsHasMore
        ? `${connectors.length} of ${approximateTotal}+`
        : `${connectors.length}`;
    }

    return connectorsHasMore
      ? `${connectors.length}+`
      : `${connectors.length}`;
  }, [
    connectors.length,
    connectorsHasMore,
    connectorsLoading,
    connectorsTotalPages,
    debouncedConnectorSearch,
  ]);

  const loadTools = useCallback(async (toolkitSlug: string, search?: string) => {
    setToolsLoading(true);
    setToolsError(null);

    try {
      const params = new URLSearchParams({ toolkit: toolkitSlug });
      if (search?.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/connectors/tools?${params.toString()}`);
      const data = (await response.json()) as {
        tools?: ConnectorTool[];
        recommendedToolSlugs?: string[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load tools");
      }

      const loadedTools = data.tools ?? [];
      const loadedRecommended = data.recommendedToolSlugs ?? loadedTools
        .filter((tool) => tool.recommended)
        .map((tool) => tool.slug);

      setTools(loadedTools);
      setRecommendedToolSlugs(loadedRecommended);

      if (
        !search?.trim() &&
        loadedTools.length > 0 &&
        !isPreferenceInitialized(toolPreferences, toolkitSlug)
      ) {
        await initializeToolkitPreferencesMutation({
          toolkitSlug,
          allToolSlugs: loadedTools.map((tool) => tool.slug),
          recommendedToolSlugs: loadedRecommended,
        });
      }
    } catch (error) {
      setTools([]);
      setToolsError(
        error instanceof Error ? error.message : "Failed to load tools"
      );
    } finally {
      setToolsLoading(false);
    }
  }, [initializeToolkitPreferencesMutation, toolPreferences]);

  useEffect(() => {
    if (!selectedSlug) {
      setTools([]);
      setRecommendedToolSlugs([]);
      setToolsError(null);
      return;
    }

    const timeout = setTimeout(() => {
      void loadTools(selectedSlug, toolSearch);
    }, toolSearch ? 300 : 0);

    return () => clearTimeout(timeout);
  }, [selectedSlug, toolSearch, loadTools]);

  const filteredTools = useMemo(() => {
    const query = toolSearch.trim().toLowerCase();

    return tools.filter((tool) => {
      const enabled = isToolEnabled(
        tool.slug,
        selectedPreference,
        recommendedToolSlugs
      );
      if (toolFilter === "enabled" && !enabled) return false;
      if (toolFilter === "disabled" && enabled) return false;

      if (!query) return true;

      const haystack = [tool.name, tool.slug, tool.description, ...tool.tags]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [tools, toolSearch, toolFilter, selectedPreference, recommendedToolSlugs]);

  const handleToggleTool = useCallback(
    async (tool: ConnectorTool, enabled: boolean) => {
      if (!selectedSlug) return;

      setTogglingToolSlug(tool.slug);
      try {
        await setToolEnabledMutation({
          toolkitSlug: selectedSlug,
          toolSlug: tool.slug,
          enabled,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update tool"
        );
      } finally {
        setTogglingToolSlug(null);
      }
    },
    [selectedSlug, setToolEnabledMutation]
  );

  const handleBulkToolUpdate = useCallback(
    async (enabled: boolean, toolSlugs?: string[]) => {
      if (!selectedSlug || tools.length === 0) return;

      setBulkUpdatingTools(true);
      try {
        const targetSlugs = toolSlugs ?? tools.map((tool) => tool.slug);
        await setToolkitToolsEnabledMutation({
          toolkitSlug: selectedSlug,
          toolSlugs: targetSlugs,
          enabled,
        });

        if (enabled && toolSlugs) {
          await setToolkitToolsEnabledMutation({
            toolkitSlug: selectedSlug,
            toolSlugs: tools.map((tool) => tool.slug),
            enabled: false,
          });
          await setToolkitToolsEnabledMutation({
            toolkitSlug: selectedSlug,
            toolSlugs,
            enabled: true,
          });
          toast.success("Recommended tools enabled for this connector.");
        } else {
          toast.success(
            enabled
              ? "All tools enabled for this connector."
              : "All tools disabled for this connector."
          );
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update tools"
        );
      } finally {
        setBulkUpdatingTools(false);
      }
    },
    [selectedSlug, tools, setToolkitToolsEnabledMutation]
  );

  const openCredentialsDialog = useCallback(async (connector: Connector) => {
    setCredentialsConnector(connector);
    setCredentialsDialogOpen(true);
    setAuthFields([]);
    setCredentialValues({});
    setAuthFieldsLoading(true);

    try {
      const response = await fetch(
        `/api/connectors/auth-fields?toolkit=${encodeURIComponent(connector.slug)}`
      );
      const data = (await response.json()) as {
        fields?: AuthField[];
        purpose?: "connection" | "auth_config";
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load connection fields");
      }

      const fields = data.fields ?? [];
      setAuthFields(fields);
      setAuthFieldsPurpose(data.purpose ?? "connection");
      setCredentialValues(
        Object.fromEntries(
          fields
            .filter((field) => field.defaultValue)
            .map((field) => [field.name, field.defaultValue ?? ""])
        )
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load connection fields"
      );
      setCredentialsDialogOpen(false);
    } finally {
      setAuthFieldsLoading(false);
    }
  }, []);

  const handleConnect = useCallback(
    async (connector: Connector, credentials?: Record<string, string>) => {
      setConnectingSlug(connector.slug);

      try {
        const response = await fetch("/api/connectors/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolkitSlug: connector.slug,
            credentials,
          }),
        });

        const data = (await response.json()) as {
          redirectUrl?: string | null;
          status?: string;
          message?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to start connection");
        }

        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }

        await loadConnections();
        setCredentialsDialogOpen(false);
        toast.success(
          data.message ?? `${connector.name} connected successfully.`
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to connect service"
        );
      } finally {
        setConnectingSlug(null);
      }
    },
    [loadConnections]
  );

  const handleDisconnect = useCallback(
    async (connectionId: string, connectorName: string) => {
      setDisconnectingId(connectionId);

      try {
        const response = await fetch(
          `/api/connectors/connections?connectionId=${encodeURIComponent(connectionId)}`,
          { method: "DELETE" }
        );
        const data = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to disconnect service");
        }

        await loadConnections();
        toast.success(`${connectorName} disconnected.`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to disconnect service"
        );
      } finally {
        setDisconnectingId(null);
      }
    },
    [loadConnections]
  );

  const handlePrimaryConnect = useCallback(
    (connector: Connector) => {
      if (connector.noAuth) {
        toast.message(`${connector.name} does not require a connection.`);
        return;
      }

      if (
        connector.requiresAuthConfigCredentials &&
        isOAuthConnector(connector)
      ) {
        void openCredentialsDialog(connector);
        return;
      }

      if (isOAuthConnector(connector)) {
        void handleConnect(connector);
        return;
      }

      if (requiresCredentials(connector)) {
        void openCredentialsDialog(connector);
      }
    },
    [handleConnect, openCredentialsDialog]
  );

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Connectors</h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
          Connect your accounts to Composio services, then choose which tools
          from each integration you want available.
        </p>
      </div>

      {connectorsError && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-3 rounded-xl border p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Could not load connectors</p>
            <p className="mt-1 opacity-90">{connectorsError}</p>
            {connectorsError.includes("COMPOSIO_API_KEY") && (
              <p className="mt-2 opacity-90">
                Add your API key from{" "}
                <a
                  href="https://app.composio.dev"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  app.composio.dev
                </a>{" "}
                to <code className="text-xs">.env.local</code> as{" "}
                <code className="text-xs">COMPOSIO_API_KEY</code>.
              </p>
            )}
          </div>
        </div>
      )}

      <section
        data-slot="card"
        className="bg-card overflow-hidden rounded-xl border border-border/50 shadow-xs"
      >
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
          <div>
            <h2 className="text-base font-medium">Your connections</h2>
            <p className="text-muted-foreground text-sm">
              Services currently linked to your account
            </p>
          </div>
          {!connectionsLoading && (
            <Badge variant="secondary" className="font-normal">
              {connectedServices.length} connected
            </Badge>
          )}
        </div>

        {connectionsLoading ? (
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {[...Array(2)].map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : connectedServices.length === 0 ? (
          <div className="text-muted-foreground px-5 py-8 text-sm">
            No services connected yet. Select a connector below and click
            Connect.
          </div>
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {connectedServices.map(({ connection, connector }) => (
              <div
                key={connection.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ConnectorLogo
                    logo={connector?.logo}
                    name={connector?.name ?? connection.toolkitSlug}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {connector?.name ?? connection.toolkitSlug}
                    </p>
                    <ConnectionStatusBadge status={connection.status} />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void handleDisconnect(
                      connection.id,
                      connector?.name ?? connection.toolkitSlug
                    )
                  }
                  disabled={disconnectingId === connection.id}
                >
                  {disconnectingId === connection.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Unlink className="size-3.5" />
                  )}
                  Disconnect
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section
          data-slot="card"
          className="bg-card flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-border/50 shadow-xs"
        >
          <div className="space-y-3 border-b border-border/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-medium">All connectors</h2>
              {connectorCountLabel && (
                <Badge variant="secondary" className="font-normal">
                  {connectorCountLabel}
                </Badge>
              )}
            </div>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={connectorSearch}
                onChange={(event) => setConnectorSearch(event.target.value)}
                placeholder="Search connectors..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {connectorsLoading && connectors.length === 0 ? (
              <ConnectorListSkeleton />
            ) : connectors.length === 0 ? (
              <EmptyState
                icon={Plug}
                title="No connectors found"
                description="Try a different search term or check your Composio API key."
              />
            ) : (
              <div className="divide-y divide-border/50">
                {connectors.map((connector) => (
                  <ConnectorRow
                    key={connector.slug}
                    connector={connector}
                    connection={getActiveConnection(
                      connectionsByToolkit[connector.slug]
                    )}
                    isSelected={selectedSlug === connector.slug}
                    isConnecting={connectingSlug === connector.slug}
                    preference={getToolkitPreference(
                      toolPreferences,
                      connector.slug
                    )}
                    onSelect={() => {
                      setSelectedSlug(connector.slug);
                      setToolSearch("");
                      setToolFilter("all");
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {!connectorsLoading && connectorsHasMore && (
            <div className="border-t border-border/50 p-4">
              <Button
                variant="outline"
                className="w-full"
                disabled={connectorsLoadingMore}
                onClick={() => {
                  if (!connectorsNextCursor) {
                    return;
                  }

                  void loadConnectorsPage({
                    cursor: connectorsNextCursor,
                    search: debouncedConnectorSearch,
                    append: true,
                  });
                }}
              >
                {connectorsLoadingMore ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Loading more...
                  </>
                ) : (
                  "Load more connectors"
                )}
              </Button>
            </div>
          )}
          {connectorsLoading && connectors.length > 0 && (
            <div className="border-t border-border/50 p-4">
              <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Searching...
              </div>
            </div>
          )}
        </section>

        <section
          data-slot="card"
          className="bg-card flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-border/50 shadow-xs"
        >
          <div className="space-y-3 border-b border-border/50 p-4">
            {selectedConnector ? (
              <ConnectorHeader
                connector={selectedConnector}
                connection={activeConnection}
                isConnecting={connectingSlug === selectedConnector.slug}
                isDisconnecting={
                  activeConnection
                    ? disconnectingId === activeConnection.id
                    : false
                }
                onConnect={() => handlePrimaryConnect(selectedConnector)}
                onDisconnect={() => {
                  if (!activeConnection) return;
                  void handleDisconnect(
                    activeConnection.id,
                    selectedConnector.name
                  );
                }}
              />
            ) : (
              <div>
                <h2 className="text-base font-medium">Tools</h2>
                <p className="text-muted-foreground text-sm">
                  Select a connector to view its tools
                </p>
              </div>
            )}

            {selectedConnector && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="secondary" className="font-normal">
                    {enabledToolCount} of {tools.length} enabled
                  </Badge>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void handleBulkToolUpdate(true, recommendedToolSlugs)
                      }
                      disabled={
                        bulkUpdatingTools ||
                        tools.length === 0 ||
                        recommendedToolSlugs.length === 0
                      }
                    >
                      Enable recommended
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleBulkToolUpdate(true)}
                      disabled={bulkUpdatingTools || tools.length === 0}
                    >
                      Enable all
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleBulkToolUpdate(false)}
                      disabled={bulkUpdatingTools || tools.length === 0}
                    >
                      Disable all
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: "all", label: "All" },
                      { value: "enabled", label: "Enabled" },
                      { value: "disabled", label: "Disabled" },
                    ] as const
                  ).map((option) => (
                    <Button
                      key={option.value}
                      variant={
                        toolFilter === option.value ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setToolFilter(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    value={toolSearch}
                    onChange={(event) => setToolSearch(event.target.value)}
                    placeholder="Search tools..."
                    className="pl-9"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!selectedConnector ? (
              <EmptyState
                icon={Wrench}
                title="No connector selected"
                description="Pick a connector from the list to browse its available tools."
              />
            ) : toolsLoading ? (
              <ToolListSkeleton />
            ) : toolsError ? (
              <div className="text-destructive p-4 text-sm">{toolsError}</div>
            ) : filteredTools.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title="No tools found"
                description={
                  toolFilter !== "all"
                    ? "No tools match the current filter."
                    : "This connector has no tools matching your search."
                }
              />
            ) : (
              <div className="divide-y divide-border/50">
                {filteredTools.map((tool) => (
                  <ToolRow
                    key={tool.slug}
                    tool={tool}
                    enabled={isToolEnabled(
                      tool.slug,
                      selectedPreference,
                      recommendedToolSlugs
                    )}
                    isUpdating={togglingToolSlug === tool.slug}
                    onToggle={(enabled) => void handleToggleTool(tool, enabled)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <Dialog
        open={credentialsDialogOpen}
        onOpenChange={setCredentialsDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Connect {credentialsConnector?.name ?? "service"}
            </DialogTitle>
            <DialogDescription>
              {authFieldsPurpose === "auth_config"
                ? "This connector uses your own OAuth app. Add the client credentials from the provider, then continue to authorize your account."
                : "Enter the credentials required to connect this service through Composio."}
            </DialogDescription>
          </DialogHeader>

          {authFieldsLoading ? (
            <div className="space-y-3 py-2">
              {[...Array(2)].map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {authFields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>
                    {field.displayName}
                    {field.required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  <Input
                    id={field.name}
                    type={field.type === "password" ? "password" : "text"}
                    value={credentialValues[field.name] ?? ""}
                    onChange={(event) =>
                      setCredentialValues((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                    placeholder={field.description}
                  />
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCredentialsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!credentialsConnector) return;
                void handleConnect(credentialsConnector, credentialValues);
              }}
              disabled={
                authFieldsLoading ||
                !credentialsConnector ||
                connectingSlug === credentialsConnector?.slug ||
                authFields.some(
                  (field) =>
                    field.required && !credentialValues[field.name]?.trim()
                )
              }
            >
              {connectingSlug === credentialsConnector?.slug ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConnectorRow({
  connector,
  connection,
  preference,
  isSelected,
  isConnecting,
  onSelect,
}: {
  connector: Connector;
  connection?: ServiceConnection;
  preference?: { disabledToolSlugs: string[]; initialized: boolean };
  isSelected: boolean;
  isConnecting: boolean;
  onSelect: () => void;
}) {
  const totalTools = connector.toolsCount ?? 0;
  const enabledCount = preference?.initialized
    ? Math.max(totalTools - preference.disabledToolSlugs.length, 0)
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "hover:bg-muted/40 flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
        isSelected && "bg-muted/50"
      )}
    >
      <ConnectorLogo logo={connector.logo} name={connector.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-medium">{connector.name}</p>
          {connection ? (
            <ConnectionStatusBadge status={connection.status} />
          ) : connector.noAuth ? (
            <Badge variant="outline" className="shrink-0 font-normal">
              No auth
            </Badge>
          ) : isConnecting ? (
            <Badge variant="outline" className="shrink-0 font-normal">
              Connecting
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground line-clamp-2 text-sm">
          {connector.description ?? connector.slug}
        </p>
        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span>
            {enabledCount !== null && totalTools > 0
              ? `${enabledCount} of ${totalTools} tools enabled`
              : `${connector.toolsCount ?? 0} tools`}
          </span>
          {connector.categories?.slice(0, 2).map((category) => (
            <Badge
              key={category.slug}
              variant="secondary"
              className="font-normal"
            >
              {category.name}
            </Badge>
          ))}
        </div>
      </div>
    </button>
  );
}

function ConnectorHeader({
  connector,
  connection,
  isConnecting,
  isDisconnecting,
  onConnect,
  onDisconnect,
}: {
  connector: Connector;
  connection?: ServiceConnection;
  isConnecting: boolean;
  isDisconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const isConnected = connection?.status === "ACTIVE";

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <ConnectorLogo logo={connector.logo} name={connector.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-medium">{connector.name}</h2>
            <Badge variant="secondary" className="font-normal">
              {connector.toolsCount ?? 0} tools
            </Badge>
            {connection ? (
              <ConnectionStatusBadge status={connection.status} />
            ) : connector.noAuth ? (
              <Badge variant="outline" className="font-normal">
                Ready to use
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {connector.description}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isConnected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onDisconnect}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Unlink className="size-3.5" />
            )}
            Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onConnect}
            disabled={isConnecting || connector.noAuth}
          >
            {isConnecting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Link2 className="size-3.5" />
            )}
            {connector.noAuth ? "No setup needed" : "Connect"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ConnectionStatusBadge({
  status,
}: {
  status: ServiceConnection["status"];
}) {
  if (status === "ACTIVE") {
    return (
      <Badge
        variant="outline"
        className="border-primary/20 text-primary gap-1 font-normal"
      >
        <CheckCircle2 className="size-3" />
        Connected
      </Badge>
    );
  }

  if (status === "INITIATED" || status === "INITIALIZING") {
    return (
      <Badge variant="outline" className="gap-1 font-normal">
        <Loader2 className="size-3 animate-spin" />
        Connecting
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="font-normal">
      {status.toLowerCase()}
    </Badge>
  );
}

function ConnectorLogo({
  logo,
  name,
  size = "sm",
}: {
  logo?: string;
  name: string;
  size?: "sm" | "lg";
}) {
  const dimension = size === "lg" ? "size-10" : "size-8";

  if (logo) {
    return (
      <img
        src={logo}
        alt={`${name} logo`}
        className={cn(dimension, "shrink-0 rounded-md object-contain")}
      />
    );
  }

  return (
    <div
      className={cn(
        dimension,
        "bg-primary/10 text-primary flex shrink-0 items-center justify-center rounded-md"
      )}
    >
      <Plug className={size === "lg" ? "size-5" : "size-4"} />
    </div>
  );
}

function ToolRow({
  tool,
  enabled,
  isUpdating,
  onToggle,
}: {
  tool: ConnectorTool;
  enabled: boolean;
  isUpdating: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "space-y-2 px-4 py-4 transition-colors",
        !enabled && "bg-muted/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                "text-base font-medium",
                !enabled && "text-muted-foreground"
              )}
            >
              {tool.name}
            </p>
            <Badge variant="outline" className="font-mono text-xs font-normal">
              {tool.slug}
            </Badge>
            {tool.recommended && (
              <Badge
                variant="secondary"
                className="border-primary/20 text-primary font-normal"
              >
                Recommended
              </Badge>
            )}
            {!enabled && (
              <Badge variant="outline" className="font-normal">
                Disabled
              </Badge>
            )}
            {tool.noAuth && (
              <Badge variant="secondary" className="font-normal">
                No auth
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {tool.description}
          </p>
          {tool.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tool.tags.map((tag, index) => (
                <Badge
                  key={`${tool.slug}-${tag}-${index}`}
                  variant="secondary"
                  className="font-normal"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <ToolToggle
          enabled={enabled}
          disabled={isUpdating}
          onChange={onToggle}
          label={`Toggle ${tool.name}`}
        />
      </div>
    </div>
  );
}

function ToolToggle({
  enabled,
  disabled,
  onChange,
  label,
}: {
  enabled: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
        enabled
          ? "bg-primary border-primary"
          : "bg-muted border-border"
      )}
    >
      <span
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow transition-transform",
          enabled ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Plug;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="bg-muted text-muted-foreground mb-4 flex size-12 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </div>
      <p className="mb-1 text-base font-medium">{title}</p>
      <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
    </div>
  );
}

function ConnectorListSkeleton() {
  return (
    <div className="space-y-0 divide-y divide-border/50">
      {[...Array(8)].map((_, index) => (
        <div key={index} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="size-8 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ToolListSkeleton() {
  return (
    <div className="space-y-0 divide-y divide-border/50">
      {[...Array(6)].map((_, index) => (
        <div key={index} className="space-y-2 px-4 py-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
