import { AuthScheme, AuthSchemeType } from "@composio/core";
import { getComposioClient } from "@/lib/composio";
import type {
  AuthField,
  ConnectorAuthFields,
  ServiceConnection,
} from "@/lib/composio-types";

const OAUTH_SCHEMES = new Set(["OAUTH1", "OAUTH2", "DCR_OAUTH"]);

type ToolkitAuthInfo = {
  authSchemes: string[];
  noAuth: boolean;
};

type RawAuthField = {
  name: string;
  displayName: string;
  description?: string;
  type: string;
  required?: boolean;
  default?: string;
};

type ToolkitLike = {
  name: string;
  authConfigDetails?: Array<{
    mode: string;
    fields?: {
      authConfigCreation?: {
        required?: RawAuthField[];
        optional?: RawAuthField[];
      };
    };
  }>;
  composioManagedAuthSchemes?: string[];
  noAuth?: boolean;
  authSchemes?: string[];
};

export function asToolkitLike(toolkit: unknown): ToolkitLike {
  return toolkit as ToolkitLike;
}

export function getToolkitAuthInfo(toolkit: ToolkitLike): ToolkitAuthInfo {
  if (toolkit.noAuth !== undefined && toolkit.authSchemes) {
    return {
      authSchemes: toolkit.authSchemes,
      noAuth: toolkit.noAuth,
    };
  }

  const authSchemes = [
    ...new Set([
      ...(toolkit.composioManagedAuthSchemes ?? []),
      ...(toolkit.authConfigDetails?.map((detail) => detail.mode) ?? []),
    ]),
  ];

  return {
    authSchemes,
    noAuth:
      authSchemes.includes("NO_AUTH") ||
      (authSchemes.length === 0 && !toolkit.authConfigDetails?.length),
  };
}

export function supportsComposioManagedAuth(toolkit: ToolkitLike): boolean {
  return (toolkit.composioManagedAuthSchemes ?? []).length > 0;
}

export function requiresCustomAuth(toolkit: ToolkitLike): boolean {
  const authInfo = getToolkitAuthInfo(toolkit);
  return !authInfo.noAuth && !supportsComposioManagedAuth(toolkit);
}

export function requiresAuthConfigCredentials(toolkit: ToolkitLike): boolean {
  if (!requiresCustomAuth(toolkit)) {
    return false;
  }

  const authScheme = getToolkitAuthInfo(toolkit).authSchemes[0];
  const detail = toolkit.authConfigDetails?.find(
    (item) => item.mode === authScheme
  );
  const requiredFields = detail?.fields?.authConfigCreation?.required ?? [];

  return requiredFields.length > 0;
}

export function isOAuthConnector(authSchemes?: string[], noAuth?: boolean) {
  if (noAuth) {
    return false;
  }

  return (authSchemes ?? []).some((scheme) => OAUTH_SCHEMES.has(scheme));
}

export function requiresCredentials(authSchemes?: string[], noAuth?: boolean) {
  if (noAuth) {
    return false;
  }

  return !isOAuthConnector(authSchemes, noAuth);
}

function mapAuthFields(
  fields: Array<{
    name: string;
    displayName: string;
    description?: string;
    type: string;
    required?: boolean;
    default?: string;
  }>
): AuthField[] {
  return fields.map((field) => ({
    name: field.name,
    displayName: field.displayName,
    description: field.description ?? "",
    type: field.type,
    required: field.required ?? false,
    defaultValue: field.default ?? undefined,
  }));
}

function getAuthConfigCreationFields(toolkit: ToolkitLike): AuthField[] {
  const authScheme = getToolkitAuthInfo(toolkit).authSchemes[0];
  const detail = toolkit.authConfigDetails?.find(
    (item) => item.mode === authScheme
  );
  const creation = detail?.fields?.authConfigCreation;

  return mapAuthFields([
    ...(creation?.required ?? []),
    ...(creation?.optional ?? []),
  ]);
}

async function getOrCreateAuthConfigId(
  toolkitSlug: string,
  customCredentials?: Record<string, string>
) {
  const composio = getComposioClient();
  const toolkit = asToolkitLike(await composio.toolkits.get(toolkitSlug));
  const existingConfigs = await composio.authConfigs.list({
    toolkit: toolkitSlug,
  });

  const authConfigId = existingConfigs.items[0]?.id;
  if (authConfigId) {
    return authConfigId;
  }

  if (!toolkit.authConfigDetails?.length) {
    throw new Error(
      `No authentication configuration is available for ${toolkit.name}.`
    );
  }

  if (supportsComposioManagedAuth(toolkit)) {
    const created = await composio.authConfigs.create(toolkitSlug, {
      type: "use_composio_managed_auth",
      name: `${toolkit.name} Auth Config`,
    });

    return created.id;
  }

  const authScheme = getPrimaryAuthScheme(toolkit);
  const created = await composio.authConfigs.create(toolkitSlug, {
    type: "use_custom_auth",
    name: `${toolkit.name} Auth Config`,
    authScheme,
    credentials: customCredentials ?? {},
  });

  return created.id;
}

function getPrimaryAuthScheme(toolkit: ToolkitLike): AuthSchemeType {
  const { authSchemes } = getToolkitAuthInfo(toolkit);
  const scheme = authSchemes[0];
  if (!scheme) {
    throw new Error("This connector does not expose an authentication method.");
  }

  return scheme as AuthSchemeType;
}

function buildConnectionConfig(
  authScheme: AuthSchemeType,
  credentials: Record<string, string>
) {
  switch (authScheme) {
    case "API_KEY":
      return AuthScheme.APIKey(credentials);
    case "BEARER_TOKEN":
      return AuthScheme.BearerToken({ token: credentials.token });
    case "BASIC":
      return AuthScheme.Basic({
        username: credentials.username,
        password: credentials.password,
      });
    case "NO_AUTH":
      return AuthScheme.NoAuth();
    default:
      throw new Error(
        `Credential-based connection is not supported for ${authScheme} yet.`
      );
  }
}

export async function listUserConnections(
  userId: string
): Promise<ServiceConnection[]> {
  const composio = getComposioClient();
  const response = await composio.connectedAccounts.list({
    userIds: [userId],
    limit: 1000,
  });

  return response.items.map((account) => ({
    id: account.id,
    toolkitSlug: account.toolkit.slug,
    status: account.status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }));
}

export async function getConnectorAuthFields(
  toolkitSlug: string
): Promise<ConnectorAuthFields> {
  const composio = getComposioClient();
  const toolkit = asToolkitLike(await composio.toolkits.get(toolkitSlug));
  const authScheme = getPrimaryAuthScheme(toolkit);

  const initiationFields =
    await composio.toolkits.getConnectedAccountInitiationFields(
      toolkitSlug,
      authScheme,
      { requiredOnly: false }
    );

  if (initiationFields.length > 0) {
    return {
      authScheme,
      purpose: "connection",
      fields: initiationFields.map((field) => ({
        name: field.name,
        displayName: field.displayName,
        description: field.description,
        type: field.type,
        required: field.required ?? false,
        defaultValue: field.default ?? undefined,
      })),
    };
  }

  return {
    authScheme,
    purpose: "auth_config",
    fields: getAuthConfigCreationFields(toolkit),
  };
}

export async function startOAuthConnection(
  userId: string,
  toolkitSlug: string,
  callbackUrl: string,
  authConfigCredentials?: Record<string, string>
) {
  const composio = getComposioClient();
  const authConfigId = await getOrCreateAuthConfigId(
    toolkitSlug,
    authConfigCredentials
  );
  const connectionRequest = await composio.connectedAccounts.link(
    userId,
    authConfigId,
    {
      callbackUrl,
      allowMultiple: true,
    }
  );

  return {
    connectionId: connectionRequest.id,
    redirectUrl: connectionRequest.redirectUrl,
    status: connectionRequest.status,
  };
}

export async function startCredentialConnection(
  userId: string,
  toolkitSlug: string,
  credentials: Record<string, string>
) {
  const composio = getComposioClient();
  const toolkit = asToolkitLike(await composio.toolkits.get(toolkitSlug));
  const authConfigId = await getOrCreateAuthConfigId(toolkitSlug, credentials);
  const authScheme = getPrimaryAuthScheme(toolkit);
  const connectionRequest = await composio.connectedAccounts.initiate(
    userId,
    authConfigId,
    {
      config: buildConnectionConfig(authScheme, credentials),
      allowMultiple: true,
    }
  );

  return {
    connectionId: connectionRequest.id,
    redirectUrl: connectionRequest.redirectUrl,
    status: connectionRequest.status,
  };
}

export async function disconnectService(connectionId: string) {
  const composio = getComposioClient();
  await composio.connectedAccounts.delete(connectionId);
}
