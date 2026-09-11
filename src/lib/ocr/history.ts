import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import type { OcrMode, ScanRow } from "./types";

type ScanDbRow = {
  id: number;
  title: string;
  mode: string;
  language: string;
  source_name: string;
  text: string;
  markdown: string;
  created_at: string;
};

function mapRow(row: ScanDbRow): ScanRow {
  return {
    id: row.id,
    title: row.title,
    mode: row.mode as OcrMode,
    language: row.language,
    sourceName: row.source_name,
    text: row.text,
    markdown: row.markdown,
    createdAt: row.created_at,
  };
}

export const listScans = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ScanRow[]> => {
    const sql = await getSql();
    const rows = await sql<ScanDbRow>`
      select id, title, mode, language, source_name, text, markdown, created_at
      from scans
      where user_id = ${context.userId}
      order by created_at desc
      limit 80
    `;
    return rows.map(mapRow);
  });

export const saveScan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        title: z.string().min(1).max(160),
        mode: z.enum(["text", "layout", "table", "receipt"]),
        language: z.string().max(8),
        sourceName: z.string().max(200),
        text: z.string().max(80_000),
        markdown: z.string().max(80_000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<ScanRow> => {
    const sql = await getSql();
    const rows = await sql<ScanDbRow>`
      insert into scans (user_id, title, mode, language, source_name, text, markdown)
      values (
        ${context.userId},
        ${data.title},
        ${data.mode},
        ${data.language},
        ${data.sourceName},
        ${data.text},
        ${data.markdown}
      )
      returning id, title, mode, language, source_name, text, markdown, created_at
    `;
    const row = rows[0];
    if (!row) throw new Error("Speichern fehlgeschlagen.");
    return mapRow(row);
  });

export const deleteScan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await sql`
      delete from scans
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return { ok: true };
  });
