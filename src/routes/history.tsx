import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { deleteScan, listScans } from "@/lib/ocr/history";
import { MODE_META, type ScanRow } from "@/lib/ocr/types";
import { toast } from "sonner";

export const Route = createFileRoute("/history")({ component: HistoryPage });

function HistoryPage() {
  const { user, isPending } = useCurrentUserState();
  const [scans, setScans] = useState<ScanRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    listScans()
      .then(setScans)
      .catch(() => setScans([]));
  }, [user]);

  if (isPending) {
    return (
      <div className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-10">
          <Skeleton className="h-8 w-40" />
          <div className="mt-6 space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </main>
      </div>
    );
  }

  if (!user) return <RedirectToSignIn />;

  async function remove(id: number) {
    try {
      await deleteScan({ data: { id } });
      setScans((prev) => (prev ?? []).filter((s) => s.id !== id));
    } catch {
      toast.error("Löschen fehlgeschlagen.");
    }
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-medium tracking-tight">Verlauf</h1>
        <p className="mt-1 text-sm text-muted">Gespeicherte Scans in diesem Konto.</p>
        <ul className="mt-8 space-y-3">
          {scans === null ? (
            <>
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </>
          ) : scans.length === 0 ? (
            <li className="rounded-xl bg-elevated px-6 py-12 text-center shadow-[var(--shadow-border)]">
              <p className="font-display text-lg font-medium">Noch leer</p>
              <p className="mt-1 text-sm text-muted">Erkenne ein Bild, dann landet es hier.</p>
              <Button asChild className="mt-4">
                <Link to="/">Zum Scanner</Link>
              </Button>
            </li>
          ) : (
            scans.map((scan) => (
              <li
                key={scan.id}
                className="rounded-xl bg-elevated p-4 shadow-[var(--shadow-border)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      <FileText className="size-4 shrink-0 text-muted" />
                      <span className="truncate">{scan.title}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {MODE_META[scan.mode].label} · {formatDate(scan.createdAt)}
                      {scan.sourceName ? ` · ${scan.sourceName}` : ""}
                    </p>
                    <p className="mt-3 line-clamp-3 font-mono text-xs leading-relaxed text-muted whitespace-pre-wrap">
                      {scan.text}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Löschen"
                    onClick={() => void remove(scan.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      </main>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
