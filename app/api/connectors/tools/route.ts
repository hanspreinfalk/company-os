import { listComposioToolsForToolkit } from "@/lib/composio-tools";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const toolkitSlug = request.nextUrl.searchParams.get("toolkit");
  const search = request.nextUrl.searchParams.get("search") ?? undefined;

  if (!toolkitSlug) {
    return NextResponse.json(
      { error: "toolkit query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const { tools, recommendedToolSlugs } = await listComposioToolsForToolkit({
      toolkitSlug,
      search,
    });

    return NextResponse.json({
      tools,
      recommendedToolSlugs,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch tools";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
