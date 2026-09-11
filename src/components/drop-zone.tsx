import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { Camera, Check, ClipboardPaste, FilePlus, ImagePlus, Loader2, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SourcePage } from "@/lib/ocr/pages";
import { cn } from "@/lib/utils";

export type SampleKind = "de" | "ja" | "zh" | "pdf" | "serie";

type Props = {
  busy: boolean;
  pages: SourcePage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onFiles: (files: File[], append: boolean) => void;
  onOpenCamera: () => void;
  onPaste: () => void;
  onSample: (kind: SampleKind) => void;
};

export function DropZone({
  busy,
  pages,
  selectedId,
  onSelect,
  onRemove,
  onFiles,
  onOpenCamera,
  onPaste,
  onSample,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const appendRef = useRef(false);
  const [over, setOver] = useState(false);
  const selected = pages.find((p) => p.id === selectedId) ?? pages[0] ?? null;

  function openPicker(append: boolean) {
    appendRef.current = append;
    inputRef.current?.click();
  }

  function takeFiles(list: FileList | File[] | null, append: boolean) {
    if (!list || list.length === 0) return;
    onFiles([...list], append);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (busy) return;
    takeFiles(e.dataTransfer.files, pages.length > 0);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (!busy) setOver(true);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    takeFiles(e.target.files, appendRef.current);
    appendRef.current = false;
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setOver(false)}
        onClick={() => {
          if (!selected) openPicker(false);
        }}
        className={cn(
          "relative flex min-h-64 w-full flex-col items-center justify-center overflow-hidden rounded-xl bg-elevated p-4 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-200 ease-[var(--ease-out)]",
          over && "shadow-[var(--shadow-border-hover)]",
          !selected && "cursor-pointer",
        )}
      >
        {selected ? (
          <>
            <img
              src={selected.dataUrl}
              alt={selected.label}
              className="max-h-80 w-full rounded-lg object-contain outline outline-1 -outline-offset-1 outline-fg/10"
            />
            {selected.status === "scanning" || (busy && selected.status !== "done") ? (
              <div className="pointer-events-none absolute inset-4 overflow-hidden rounded-lg">
                <div className="scan-line absolute inset-x-0 h-16 bg-linear-to-b from-transparent via-fg/25 to-transparent animate-[scan-sweep_1.6s_linear_infinite]" />
              </div>
            ) : null}
            <p className="mt-2 w-full truncate text-center text-xs text-muted">{selected.label}</p>
            {!busy ? (
              <button
                type="button"
                aria-label="Seite entfernen"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(selected.id);
                }}
                className="absolute top-3 right-3 grid size-8 place-items-center rounded-md bg-elevated/90 text-fg shadow-[var(--shadow-border)]"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <span className="grid size-12 place-items-center rounded-md bg-fg/6 text-fg">
              <ScanLine className="size-6" strokeWidth={1.5} />
            </span>
            <div>
              <p className="font-display text-xl font-medium tracking-tight">PDF oder Bilder</p>
              <p className="mt-1 max-w-xs text-sm text-muted">
                Ganzes PDF, mehrere Fotos oder ein Scan. Bis zu 20 Seiten.
              </p>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={onChange}
        />
      </div>

      {pages.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {pages.map((page, i) => (
            <div key={page.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => onSelect(page.id)}
                className={cn(
                  "block size-16 overflow-hidden rounded-md bg-elevated shadow-[var(--shadow-border)]",
                  page.id === selected?.id && "ring-2 ring-fg",
                )}
              >
                <img src={page.dataUrl} alt="" className="size-full object-cover" />
              </button>
              <span className="pointer-events-none absolute top-1 left-1 grid size-5 place-items-center rounded-sm bg-elevated/90 text-[10px] font-medium">
                {page.status === "scanning" ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : page.status === "done" ? (
                  <Check className="size-3 text-ok" />
                ) : (
                  i + 1
                )}
              </span>
              {!busy ? (
                <button
                  type="button"
                  aria-label="Seite entfernen"
                  onClick={() => onRemove(page.id)}
                  className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-fg text-primary-fg"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          ))}
          {!busy && pages.length < 20 ? (
            <button
              type="button"
              onClick={() => openPicker(true)}
              className="grid size-16 shrink-0 place-items-center rounded-md bg-fg/5 text-muted hover:bg-fg/8"
              aria-label="Weitere Seiten"
            >
              <FilePlus className="size-5" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button type="button" variant="secondary" onClick={() => openPicker(pages.length > 0)} disabled={busy}>
          <ImagePlus />
          {pages.length ? "Weitere" : "Datei"}
        </Button>
        <Button type="button" variant="secondary" onClick={onOpenCamera} disabled={busy}>
          <Camera />
          Kamera
        </Button>
        <Button type="button" variant="secondary" onClick={onPaste} disabled={busy}>
          <ClipboardPaste />
          Einfügen
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" disabled={busy}>
              Beispiel
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onSample("de")}>Rechnung · Deutsch</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSample("ja")}>Aushang · Japanisch</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSample("zh")}>Mitteilung · Chinesisch</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSample("pdf")}>Vertrag · PDF, 3 Seiten</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSample("serie")}>Serie · 3 Fotos</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
