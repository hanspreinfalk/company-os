export type ConnectorCategory = {
  slug: string;
  name: string;
};

export type Connector = {
  slug: string;
  name: string;
  description?: string;
  logo?: string;
  appUrl?: string;
  toolsCount?: number;
  triggersCount?: number;
  categories?: ConnectorCategory[];
  noAuth?: boolean;
  authSchemes?: string[];
  requiresCustomAuth?: boolean;
  requiresAuthConfigCredentials?: boolean;
};

export type ConnectorTool = {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  noAuth: boolean;
  recommended: boolean;
  toolkitSlug: string;
  toolkitName: string;
};

export type ServiceConnectionStatus =
  | "INITIALIZING"
  | "INITIATED"
  | "ACTIVE"
  | "FAILED"
  | "EXPIRED"
  | "INACTIVE"
  | "REVOKED";

export type ServiceConnection = {
  id: string;
  toolkitSlug: string;
  status: ServiceConnectionStatus;
  createdAt: string;
  updatedAt: string;
};

export type AuthField = {
  name: string;
  displayName: string;
  description: string;
  type: string;
  required: boolean;
  defaultValue?: string;
};

export type ConnectorAuthFields = {
  authScheme: string;
  fields: AuthField[];
  purpose: "connection" | "auth_config";
};
