import { getAuthenticatedUserId } from "@/lib/api-auth";
import { getConnectorAuthFields } from "@/lib/composio-connect";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const toolkitSlug = request.nextUrl.searchParams.get("toolkit");
  if (!toolkitSlug) {
    return NextResponse.json(
      { error: "toolkit query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const authFields = await getConnectorAuthFields(toolkitSlug);
    return NextResponse.json(authFields);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch auth fields";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
