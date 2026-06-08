import {
  CONNECTORS_PAGE_SIZE,
  getComposioConnectorBySlug,
  listComposioConnectors,
} from "@/lib/composio-connectors";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();

  if (slug) {
    try {
      const connector = await getComposioConnectorBySlug(slug);
      if (!connector) {
        return NextResponse.json(
          { error: "Connector not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ connector });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch connector";

      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : CONNECTORS_PAGE_SIZE;

  try {
    const result = await listComposioConnectors({
      cursor,
      search,
      limit: Number.isFinite(limit) ? limit : CONNECTORS_PAGE_SIZE,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch connectors";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
