import { useState } from "react";
import { Check, Copy, Download, Languages, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OcrResult } from "@/lib/ocr/types";
import { countWords } from "@/lib/ocr/image";
import { cn } from "@/lib/utils";

type Props = {
  result: OcrResult | null;
  busy: boolean;
  busyLabel?: string;
  progress?: { current: number; total: number };
  translating: boolean;
  onPatch: (patch: Partial<OcrResult>) => void;
  onTranslate: (target: "de" | "en" | "fr" | "es" | "it") => void;
};

export function ResultPanel({
  result,
  busy,
  busyLabel,
  progress,
  translating,
  onPatch,
  onTranslate,
}: Props) {
  const [view, setView] = useState<"text" | "markdown">("text");
  const [copied, setCopied] = useState(false);
  const value = result ? (view === "markdown" ? result.markdown : result.text) : "";
  const words = countWords(value);
  const chars = value.length;
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  async function copy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function download() {
    if (!value) return;
    const ext = view === "markdown" ? "md" : "txt";
    const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(result?.title ?? "klartext")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex min-h-64 flex-col rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)] sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-medium tracking-tight">Ergebnis</h2>
          {result ? (
            <>
              <Badge variant="muted">{words} Wörter</Badge>
              <Badge variant="muted" className="hidden sm:inline-flex">
                {chars} Zeichen
              </Badge>
            </>
          ) : null}
        </div>
        <div className="flex rounded-md bg-fg/6 p-0.5">
          {(["text", "markdown"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                "h-8 rounded-sm px-3 text-xs font-medium transition-colors",
                view === id ? "bg-elevated text-fg shadow-[var(--shadow-border)]" : "text-muted",
              )}
            >
              {id === "text" ? "Text" : "Markdown"}
            </button>
          ))}
        </div>
      </div>

      {busy && progress && progress.total > 1 ? (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
            <span>{busyLabel ?? "Text wird gelesen…"}</span>
            <span>
              {progress.current}/{progress.total}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-fg/10">
            <div
              className="h-full rounded-full bg-fg transition-[width] duration-300 ease-[var(--ease-out)]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}

      {busy && !result && !(progress && progress.total > 1) ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-muted">
          <Loader2 className="size-6 animate-spin" />
          <p className="text-sm">{busyLabel ?? "Text wird gelesen…"}</p>
        </div>
      ) : busy && !result ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-muted">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : result ? (
        <>
          <Textarea
            value={value}
            onChange={(e) =>
              onPatch(view === "markdown" ? { markdown: e.target.value } : { text: e.target.value })
            }
            className="min-h-72 flex-1"
            spellCheck={false}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void copy()} disabled={busy}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Kopiert" : "Kopieren"}
            </Button>
            <Button type="button" variant="secondary" onClick={download} disabled={busy}>
              <Download />
              Download
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" disabled={translating || busy}>
                  {translating ? <Loader2 className="animate-spin" /> : <Languages />}
                  {translating ? "Übersetzt…" : "Alles übersetzen"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => onTranslate("de")}>Deutsch</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onTranslate("en")}>English</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onTranslate("fr")}>Français</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onTranslate("es")}>Español</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onTranslate("it")}>Italiano</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <p className="font-display text-lg font-medium tracking-tight">Noch kein Text</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            PDF oder mehrere Bilder ablegen, dann auf Text erkennen.
          </p>
        </div>
      )}
    </section>
  );
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "klartext"
  );
}
