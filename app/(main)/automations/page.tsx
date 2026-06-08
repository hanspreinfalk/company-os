import { Metadata } from "next";
import { AutomationsPage } from "./automations-page";

export const metadata: Metadata = {
  title: "Automations",
  description: "Automation runs that keep your notes indexed and up to date.",
};

export default function Page() {
  return <AutomationsPage />;
}
