import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ScanText } from "lucide-react";
import { toast } from "sonner";
import { AppHeader, HistoryHint } from "@/components/app-header";
import { CameraDialog } from "@/components/camera-dialog";
import { DropZone, type SampleKind } from "@/components/drop-zone";
import { ResultPanel } from "@/components/result-panel";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { extractText, translateText } from "@/lib/ocr/extract";
import { saveScan } from "@/lib/ocr/history";
import { prepareImageFromUrl } from "@/lib/ocr/image";
import { combinePages, filesToPages, sourceLabel, type SourcePage } from "@/lib/ocr/pages";
import {
  MODE_META,
  OCR_LANGUAGES,
  OCR_MODES,
  type OcrLanguage,
  type OcrMode,
  type OcrResult,
} from "@/lib/ocr/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user } = useCurrentUserState();
  const [pages, setPages] = useState<SourcePage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<OcrMode>("text");
  const [language, setLanguage] = useState<OcrLanguage>("auto");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [translating, setTranslating] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [edited, setEdited] = useState<OcrResult | null>(null);

  const combined = useMemo(() => combinePages(pages), [pages]);
  const result = edited ?? combined;
  const selected = pages.find((p) => p.id === selectedId) ?? pages[0] ?? null;

  const loadFiles = useCallback(async (files: File[], append: boolean) => {
    try {
      const { pages: next, warning } = await filesToPages(files, append ? pages.length : 0);
      setPages((prev) => {
        const merged = append ? [...prev, ...next] : next;
        setSelectedId(append ? (next[0]?.id ?? prev[0]?.id ?? null) : (next[0]?.id ?? null));
        return merged;
      });
      setEdited(null);
      setSaved(false);
      if (warning) toast.message(warning);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dateien konnten nicht gelesen werden.");
    }
  }, [pages.length]);

  const loadFile = useCallback(
    async (file: File) => {
      await loadFiles([file], pages.length > 0);
    },
    [loadFiles, pages.length],
  );

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const images = [...(e.clipboardData?.items ?? [])]
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => Boolean(f));
      if (!images.length) return;
      e.preventDefault();
      void loadFiles(images, pages.length > 0);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFiles, pages.length]);

  async function pasteFromClipboard() {
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        files.push(new File([blob], "zwischenablage.jpg", { type: blob.type }));
      }
      if (!files.length) {
        toast.error("Kein Bild in der Zwischenablage.");
        return;
      }
      await loadFiles(files, pages.length > 0);
    } catch {
      toast.error("Zwischenablage nicht lesbar. Strg+V direkt auf der Seite nutzen.");
    }
  }

  async function loadSample(kind: SampleKind) {
    try {
      if (kind === "pdf") {
        const res = await fetch("/sample-vertrag.pdf");
        if (!res.ok) throw new Error("Beispiel nicht gefunden.");
        const blob = await res.blob();
        const file = new File([blob], "mustervertrag.pdf", { type: "application/pdf" });
        setMode("layout");
        setLanguage("de");
        await loadFiles([file], false);
        return;
      }
      if (kind === "serie") {
        const items = [
          { url: "/sample-letter.jpg", name: "rechnung.jpg" },
          { url: "/sample-ja.jpg", name: "aushang.jpg" },
          { url: "/sample-zh.jpg", name: "mitteilung.jpg" },
        ];
        const files: File[] = [];
        for (const item of items) {
          const res = await fetch(item.url);
          if (!res.ok) throw new Error("Beispiel nicht gefunden.");
          const blob = await res.blob();
          files.push(new File([blob], item.name, { type: blob.type || "image/jpeg" }));
        }
        setMode("text");
        setLanguage("auto");
        await loadFiles(files, false);
        return;
      }
      const samples = {
        de: { url: "/sample-letter.jpg", name: "beispiel-rechnung.jpg", mode: "receipt" as const, language: "de" as const },
        ja: { url: "/sample-ja.jpg", name: "beispiel-japanisch.jpg", mode: "text" as const, language: "ja" as const },
        zh: { url: "/sample-zh.jpg", name: "beispiel-chinesisch.jpg", mode: "text" as const, language: "zh" as const },
      };
      const sample = samples[kind];
      const prepared = await prepareImageFromUrl(sample.url, sample.name);
      const page: SourcePage = {
        id: crypto.randomUUID(),
        dataUrl: prepared.dataUrl,
        width: prepared.width,
        height: prepared.height,
        label: prepared.name,
        sourceName: prepared.name,
        status: "ready",
      };
      setPages([page]);
      setSelectedId(page.id);
      setEdited(null);
      setSaved(false);
      setMode(sample.mode);
      setLanguage(sample.language);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Beispiel nicht gefunden.");
    }
  }

  function removePage(id: string) {
    setPages((prev) => {
      const next = prev.filter((p) => p.id !== id);
      setSelectedId((cur) => (cur === id ? (next[0]?.id ?? null) : cur));
      return next;
    });
    setEdited(null);
    setSaved(false);
  }

  async function runOcr() {
    if (!pages.length || busy) return;
    setBusy(true);
    setSaved(false);
    setEdited(null);
    setProgress({ current: 0, total: pages.length });

    const working: SourcePage[] = pages.map((p) => ({
      ...p,
      status: "ready",
      error: undefined,
      result: undefined,
    }));
    setPages(working);

    let failed = 0;
    for (let i = 0; i < working.length; i++) {
      const page = working[i];
      if (!page) continue;
      working[i] = { ...page, status: "scanning" };
      setSelectedId(page.id);
      setPages([...working]);
      try {
        const response = await extractText({
          data: {
            imageDataUrl: page.dataUrl,
            mode,
            language,
            pageIndex: i,
            pageCount: working.length,
          },
        });
        if (!response.ok) {
          failed += 1;
          working[i] = { ...page, status: "error", error: response.error };
        } else {
          working[i] = { ...page, status: "done", result: response.result };
        }
      } catch (err) {
        failed += 1;
        working[i] = {
          ...page,
          status: "error",
          error: err instanceof Error ? err.message : "Texterkennung fehlgeschlagen.",
        };
      }
      setPages([...working]);
      setProgress({ current: i + 1, total: working.length });
    }

    setBusy(false);

    if (failed && failed === working.length) {
      toast.error("Keine Seite konnte gelesen werden.");
      return;
    }
    if (failed) toast.message(`${failed} Seite${failed === 1 ? "" : "n"} nicht erkannt, Rest ist fertig.`);

    const doc = combinePages(working);
    if (!user || !doc) return;
    try {
      await saveScan({
        data: {
          title: doc.title,
          mode,
          language: doc.language || language,
          sourceName: sourceLabel(working),
          text: doc.text,
          markdown: doc.markdown,
        },
      });
      setSaved(true);
    } catch {
      /* guest-style fallback if session expired */
    }
  }

  async function onTranslate(target: "de" | "en" | "fr" | "es" | "it") {
    if (translating) return;
    const withText = pages.filter((p) => p.result?.text);
    if (!withText.length && result) {
      setTranslating(true);
      try {
        const response = await translateText({
          data: { text: result.markdown || result.text, target },
        });
        if (!response.ok) {
          toast.error(response.error);
          return;
        }
        setEdited({ ...result, text: response.text, markdown: response.text });
      } catch {
        toast.error("Übersetzung fehlgeschlagen.");
      } finally {
        setTranslating(false);
      }
      return;
    }
    if (!withText.length) return;
    setTranslating(true);
    try {
      let failed = 0;
      for (const page of withText) {
        const source = page.result?.markdown || page.result?.text || "";
        const response = await translateText({ data: { text: source, target } });
        if (!response.ok) {
          failed += 1;
          continue;
        }
        setPages((prev) =>
          prev.map((p) =>
            p.id === page.id && p.result
              ? { ...p, result: { ...p.result, text: response.text, markdown: response.text } }
              : p,
          ),
        );
      }
      setEdited(null);
      if (failed) toast.message(`${failed} Seite${failed === 1 ? "" : "n"} nicht übersetzt.`);
    } catch {
      toast.error("Übersetzung fehlgeschlagen.");
    } finally {
      setTranslating(false);
    }
  }

  const busyLabel =
    busy && pages.length > 1
      ? `Seite ${Math.min(progress.current + 1, progress.total)} von ${progress.total} wird gelesen…`
      : busy
        ? "Text wird gelesen…"
        : undefined;

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div className="fade-up mb-8 max-w-xl animate-[fade-up_500ms_var(--ease-out)]">
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">OCR</p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tight sm:text-5xl">
            Text aus Bildern und PDFs
          </h1>
          <p className="mt-3 text-base text-muted">
            Ganzes PDF oder eine Serie Fotos ablegen. Jede Seite wird nacheinander gelesen und kann danach komplett übersetzt werden.
          </p>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <DropZone
              busy={busy}
              pages={pages}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
              onRemove={removePage}
              onFiles={(files, append) => void loadFiles(files, append)}
              onOpenCamera={() => setCameraOpen(true)}
              onPaste={() => void pasteFromClipboard()}
              onSample={(kind) => void loadSample(kind)}
            />

            <div className="rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)] sm:p-4">
              <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Modus</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {OCR_MODES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMode(id)}
                    className={cn(
                      "h-11 rounded-md px-3 text-sm font-medium transition-colors",
                      mode === id ? "bg-primary text-primary-fg" : "bg-fg/5 text-fg hover:bg-fg/8",
                    )}
                  >
                    {MODE_META[id].label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">{MODE_META[mode].hint}</p>
              <label className="mt-4 flex flex-col gap-1.5 text-sm">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">
                  Sprache
                </span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as OcrLanguage)}
                  className="h-11 rounded-md bg-bg px-3 text-sm shadow-[var(--shadow-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/25"
                >
                  {OCR_LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => void runOcr()} disabled={!pages.length || busy} size="lg">
                  {busy ? <Loader2 className="animate-spin" /> : <ScanText />}
                  {pages.length > 1 ? `${pages.length} Seiten erkennen` : "Text erkennen"}
                </Button>
                {saved ? (
                  <span className="text-xs text-ok">Im Verlauf gespeichert</span>
                ) : (
                  <HistoryHint />
                )}
              </div>
            </div>
          </div>

          <ResultPanel
            result={result}
            busy={busy}
            busyLabel={busyLabel}
            progress={pages.length > 1 ? progress : undefined}
            translating={translating}
            onPatch={(patch) =>
              setEdited((prev) => {
                const base = prev ?? combined;
                return base ? { ...base, ...patch } : prev;
              })
            }
            onTranslate={(target) => void onTranslate(target)}
          />
        </div>
      </main>
      <CameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => void loadFile(file)}
      />
    </div>
  );
}
