"use client";

import { useParams } from "next/navigation";
import { NoteView } from "@/components/note-view";

export default function NotePage() {
  const params = useParams();
  const raw = params.path;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const path = arr.map((s) => decodeURIComponent(s)).join("/");
  if (!path) return null;
  return <NoteView path={path} />;
}
