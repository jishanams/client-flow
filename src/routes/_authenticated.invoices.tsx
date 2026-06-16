import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ClientPicker } from "@/components/ClientPicker";
import { InvoiceDetailDialog } from "@/components/InvoiceDetailDialog";
import { inr, fmtDate, todayISO } from "@/lib/format";
import { nextInvoiceNumber } from "@/lib/numbering";
import { Plus, Trash2, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseInvoiceText } from "@/lib/api/invoice-ai.functions";


export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [{ title: "Invoices — DO Business Manager" }] }),
  component: InvoicesPage,
});

type Item = { description: string; qty: number; rate: number };

function InvoicesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => (await supabase.from("invoices").select("*, client:clients(*)").is("deleted_at", null).order("invoice_date", { ascending: false })).data ?? [],
  });

  const remove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Move this invoice to Trash?")) return;
    const { error } = await supabase.from("invoices").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Moved to Trash");
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["trash", "invoices"] });
  };

  void user;

  return (
    <div>
      <PageHeader title="Invoices" description="Tap any invoice to view, download PDF, or record a payment." action={<NewInvoiceDialog />} />
      {!invoices.length ? (
        <Card className="p-12 rounded-2xl border text-center text-muted-foreground">No invoices yet.</Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((i: any) => {
            const pending = Number(i.total) - Number(i.paid_amount);
            return (
              <Card
                key={i.id}
                onClick={() => setOpenId(i.id)}
                className="p-4 rounded-xl border cursor-pointer hover:shadow-card transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{i.invoice_number} · {i.client?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">{fmtDate(i.invoice_date)}{i.due_date ? ` · Due ${fmtDate(i.due_date)}` : ""}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold">{inr(i.total)}</div>
                    <Badge
                      variant={i.status === "paid" ? "secondary" : i.status === "partially_paid" ? "outline" : "destructive"}
                      className="rounded-full text-[10px] capitalize"
                    >
                      {pending > 0 ? `${inr(pending)} due` : "Paid"}
                    </Badge>
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={(e) => remove(e, i.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <InvoiceDetailDialog invoiceId={openId} open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}

function NewInvoiceDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [gstPct, setGstPct] = useState(18);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: "", qty: 1, rate: 0 }]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const runAiImport = async () => {
    if (!aiText.trim()) return toast.error("Paste the report text first");
    setAiBusy(true);
    try {
      const res = await parseInvoiceText({ data: { text: aiText } });
      if (!res.items.length) {
        toast.error("Couldn't find any items in that text");
        return;
      }
      let next = res.items;
      // If AI returned a package total but item rates are all 0, put the total on the first item
      const sum = next.reduce((s, i) => s + i.qty * i.rate, 0);
      if (sum === 0 && res.total && next.length > 0) {
        next = next.map((i, idx) => idx === 0 ? { ...i, rate: res.total! } : i);
      }
      setItems(next);
      if (res.notes) setNotes(res.notes);
      setAiOpen(false);
      setAiText("");
      toast.success(`Imported ${next.length} items`);
    } catch (e: any) {
      toast.error(e?.message ?? "AI import failed");
    } finally {
      setAiBusy(false);
    }
  };

  const subtotal = items.reduce((s, it) => s + Number(it.qty) * Number(it.rate), 0);
  const gstAmount = ((subtotal - Number(discount)) * Number(gstPct)) / 100;
  const total = subtotal - Number(discount) + gstAmount;

  const save = async () => {
    if (!user || !clientId) return toast.error("Select a client");
    if (!items.some((i) => i.description)) return toast.error("Add at least one item");
    const num = await nextInvoiceNumber(user.id);
    const { error } = await supabase.from("invoices").insert({
      user_id: user.id, client_id: clientId, invoice_number: num,
      invoice_date: invoiceDate, due_date: dueDate || null,
      items: items as any, subtotal, gst_amount: gstAmount, discount, total, notes,
    });
    if (error) return toast.error(error.message);
    toast.success("Invoice created");
    setOpen(false);
    setItems([{ description: "", qty: 1, rate: 0 }]); setClientId(""); setNotes("");
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dash-stats"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="rounded-xl gap-2"><Plus className="h-4 w-4" />New invoice</Button></DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-3"><Label>Client</Label>
              <ClientPicker value={clientId} onChange={setClientId} />
            </div>
            <div className="space-y-1.5"><Label>Date <span className="text-[10px] text-muted-foreground font-normal">(backdate ok)</span></Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>GST %</Label><Input type="number" value={gstPct} onChange={(e) => setGstPct(Number(e.target.value))} /></div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5 h-8" onClick={() => setAiOpen((v) => !v)}>
                <Sparkles className="h-3.5 w-3.5" />{aiOpen ? "Hide AI import" : "Import from report (AI)"}
              </Button>
            </div>
            {aiOpen && (
              <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Paste the monthly report from your team (or Claude output). AI will extract items automatically.
                </p>
                <Textarea
                  rows={6}
                  placeholder={"e.g. May 2026\n1. Poster — May for Mountains (2 Slides Carousel)\n2. Reel — Testimonial Reel\n...\nTotal: ₹50,000 (All-Inclusive Package)"}
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                />
                <Button type="button" size="sm" className="rounded-xl gap-1.5" onClick={runAiImport} disabled={aiBusy}>
                  {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {aiBusy ? "Parsing..." : "Parse & fill items"}
                </Button>
              </div>
            )}
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2">
                <Input className="col-span-6" placeholder="Description" value={it.description} onChange={(e) => { const n = [...items]; n[idx].description = e.target.value; setItems(n); }} />
                <Input className="col-span-2" type="number" placeholder="Qty" value={it.qty} onChange={(e) => { const n = [...items]; n[idx].qty = Number(e.target.value); setItems(n); }} />
                <Input className="col-span-3" type="number" placeholder="Rate" value={it.rate} onChange={(e) => { const n = [...items]; n[idx].rate = Number(e.target.value); setItems(n); }} />
                <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setItems([...items, { description: "", qty: 1, rate: 0 }])}><Plus className="h-4 w-4" />Add item</Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Discount (₹)</Label><Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>

          <div className="rounded-xl bg-muted/40 p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>−{inr(discount)}</span></div>
            <div className="flex justify-between"><span>GST ({gstPct}%)</span><span>{inr(gstAmount)}</span></div>
            <div className="flex justify-between font-semibold text-base pt-2 border-t"><span>Total</span><span>{inr(total)}</span></div>
          </div>
          <Button onClick={save} className="w-full h-11 rounded-xl">Create invoice</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
