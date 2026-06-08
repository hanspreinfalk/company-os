import { Metadata } from "next";
import { NotesPage } from "./notes-page";

export const metadata: Metadata = {
  title: "Notes",
  description: "Your knowledge base and AI-powered notes.",
};

export default function Page() {
  return <NotesPage />;
}
