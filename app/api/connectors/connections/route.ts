import { getAuthenticatedUserId } from "@/lib/api-auth";
import {
  disconnectService,
  listUserConnections,
} from "@/lib/composio-connect";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connections = await listUserConnections(userId);
    return NextResponse.json({ connections });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch connections";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectionId = request.nextUrl.searchParams.get("connectionId");
  if (!connectionId) {
    return NextResponse.json(
      { error: "connectionId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const connections = await listUserConnections(userId);
    const ownsConnection = connections.some(
      (connection) => connection.id === connectionId
    );

    if (!ownsConnection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    await disconnectService(connectionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to disconnect service";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
