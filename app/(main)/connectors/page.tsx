import { Metadata } from "next";
import { Suspense } from "react";
import { ConnectorsPage } from "./connectors-page";

export const metadata: Metadata = {
  title: "Connectors",
  description: "Browse Composio connectors and their available tools.",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
      <ConnectorsPage />
    </Suspense>
  );
}
