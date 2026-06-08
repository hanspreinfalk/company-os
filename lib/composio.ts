import { Composio } from "@composio/core";

let composioClient: Composio | null = null;

export function getComposioClient(): Composio {
  const apiKey = process.env.COMPOSIO_API_KEY;

  if (!apiKey) {
    throw new Error(
      "COMPOSIO_API_KEY is not set. Add it to your .env.local file."
    );
  }

  if (!composioClient) {
    composioClient = new Composio({
      apiKey,
      toolkitVersions: "latest",
    });
  }

  return composioClient;
}
