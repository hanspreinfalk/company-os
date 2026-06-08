import { Metadata } from "next";
import { NoteDetailPage } from "../note-detail-page";

export const metadata: Metadata = {
  title: "Note",
};

export default async function Page({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  return <NoteDetailPage noteId={noteId} />;
}
