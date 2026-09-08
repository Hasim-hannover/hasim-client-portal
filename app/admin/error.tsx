"use client";

import { WorkspaceError } from "@/app/workspace-error";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <WorkspaceError reset={reset} title="Adminbereich konnte nicht geladen werden" />;
}
