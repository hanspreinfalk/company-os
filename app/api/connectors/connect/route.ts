import { getAuthenticatedUserId } from "@/lib/api-auth";
import {
  asToolkitLike,
  getToolkitAuthInfo,
  isOAuthConnector,
  requiresAuthConfigCredentials,
  requiresCredentials,
  requiresCustomAuth,
  startCredentialConnection,
  startOAuthConnection,
} from "@/lib/composio-connect";
import { getComposioClient } from "@/lib/composio";
import { NextRequest, NextResponse } from "next/server";

type ConnectRequestBody = {
  toolkitSlug?: string;
  credentials?: Record<string, string>;
};

function formatComposioError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Failed to start connection";
  }

  try {
    const parsed = JSON.parse(error.message) as {
      error?: { message?: string; suggested_fix?: string };
    };

    if (parsed.error?.message) {
      return parsed.error.suggested_fix
        ? `${parsed.error.message} ${parsed.error.suggested_fix}`
        : parsed.error.message;
    }
  } catch {
    // Not JSON — fall through to the raw message.
  }

  return error.message;
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ConnectRequestBody;
  try {
    body = (await request.json()) as ConnectRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const toolkitSlug = body.toolkitSlug?.trim();
  if (!toolkitSlug) {
    return NextResponse.json(
      { error: "toolkitSlug is required" },
      { status: 400 }
    );
  }

  try {
    const composio = getComposioClient();
    const toolkitAuth = asToolkitLike(await composio.toolkits.get(toolkitSlug));
    const authInfo = getToolkitAuthInfo(toolkitAuth);

    if (authInfo.noAuth) {
      return NextResponse.json({
        connectionId: null,
        redirectUrl: null,
        status: "ACTIVE",
        message: "This connector does not require authentication.",
      });
    }

    if (isOAuthConnector(authInfo.authSchemes, authInfo.noAuth)) {
      if (
        requiresCustomAuth(toolkitAuth) &&
        requiresAuthConfigCredentials(toolkitAuth) &&
        (!body.credentials || Object.keys(body.credentials).length === 0)
      ) {
        return NextResponse.json(
          {
            error:
              "This connector requires your own OAuth app credentials before connecting.",
          },
          { status: 400 }
        );
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin;
      const callbackUrl = `${baseUrl}/connectors?connected=${encodeURIComponent(toolkitSlug)}`;
      const result = await startOAuthConnection(
        userId,
        toolkitSlug,
        callbackUrl,
        body.credentials
      );

      if (!result.redirectUrl) {
        return NextResponse.json(
          { error: "Composio did not return an authorization URL." },
          { status: 500 }
        );
      }

      return NextResponse.json(result);
    }

    if (requiresCredentials(authInfo.authSchemes, authInfo.noAuth)) {
      const credentials = body.credentials;
      if (!credentials || Object.keys(credentials).length === 0) {
        return NextResponse.json(
          { error: "credentials are required for this connector" },
          { status: 400 }
        );
      }

      const result = await startCredentialConnection(
        userId,
        toolkitSlug,
        credentials
      );

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "This connector uses an unsupported authentication method." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: formatComposioError(error) },
      { status: 500 }
    );
  }
}
