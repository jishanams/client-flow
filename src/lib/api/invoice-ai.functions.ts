import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Parse an unstructured invoice/report (text pasted from a team report,
// Claude output, WhatsApp summary, etc.) into structured invoice items
// using the Lovable AI Gateway. No API key needed from the user.

const ItemSchema = z.object({
  description: z.string(),
  qty: z.number().default(1),
  rate: z.number().default(0),
});

export type ParsedInvoice = {
  items: { description: string; qty: number; rate: number }[];
  total?: number;
  notes?: string;
};

export const parseInvoiceText = createServerFn({ method: "POST" })
  .inputValidator(z.object({ text: z.string().min(5).max(20000) }))
  .handler(async ({ data }): Promise<ParsedInvoice> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const system = `You extract invoice line items from messy reports.
Return STRICT JSON only, matching:
{ "items":[{"description":string,"qty":number,"rate":number}], "total":number|null, "notes":string|null }

Rules:
- One item per row in the report. Keep description concise but informative (include type like "Poster", "Reel" if present).
- If the report shows a single "All-Inclusive Package" total and items have no individual rates, set rate=0 for each item and set "total" to the package amount. The caller will reconcile.
- qty defaults to 1 unless the row clearly shows a quantity.
- rate must be a number in INR with no symbols or commas.
- If unclear, prefer rate=0 over guessing.
- Output JSON only — no markdown, no commentary.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.text },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI gateway error ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const items = Array.isArray(parsed.items)
      ? parsed.items.map((i: any) => ItemSchema.parse({
          description: String(i.description ?? "").trim(),
          qty: Number(i.qty) || 1,
          rate: Number(i.rate) || 0,
        })).filter((i: any) => i.description)
      : [];

    return {
      items,
      total: parsed.total != null ? Number(parsed.total) || undefined : undefined,
      notes: parsed.notes ? String(parsed.notes) : undefined,
    };
  });
