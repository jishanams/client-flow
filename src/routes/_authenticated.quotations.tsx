import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ClientPicker } from "@/components/ClientPicker";
import { QuotationDetailDialog } from "@/components/QuotationDetailDialog";
import { Badge } from "@/components/ui/badge";
import { inr, fmtDate, todayISO } from "@/lib/format";
import { nextQuotationNumber } from "@/lib/numbering";
import { Plus, Trash2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/quotations")({
  head: () => ({ meta: [{ title: "Quotations — DO Business Manager" }] }),
  component: QuotationsPage,
});

function QuotationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [items, setItems] = useState([{ description: "", qty: 1, rate: 0 }]);
  const [gstPct, setGstPct] = useState(18);
  const [discount, setDiscount] = useState(0);

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotations"],
    queryFn: async () => (await supabase.from("quotations").select("*, client:clients(*)").is("deleted_at", null).order("quote_date", { ascending: false })).data ?? [],
  });

  const subtotal = items.reduce((s, it) => s + Number(it.qty) * Number(it.rate), 0);
  const gstAmount = ((subtotal - discount) * gstPct) / 100;
  const total = subtotal - discount + gstAmount;

  const save = async () => {
    if (!user) return;
    if (!clientId) return toast.error("Select a client");
    const num = await nextQuotationNumber(user.id);
    const { error } = await supabase.from("quotations").insert({
      user_id: user.id, client_id: clientId, quotation_number: num,
      quote_date: todayISO(), items: items as any, subtotal, gst_amount: gstAmount, discount, total,
    });
    if (error) return toast.error(error.message);
    toast.success("Quotation created");
    setOpen(false);
    setItems([{ description: "", qty: 1, rate: 0 }]); setClientId("");
    qc.invalidateQueries({ queryKey: ["quotations"] });
  };

  const remove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Move this quotation to Trash?")) return;
    const { error } = await supabase.from("quotations").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Moved to Trash");
    qc.invalidateQueries({ queryKey: ["quotations"] });
    qc.invalidateQueries({ queryKey: ["trash", "quotations"] });
  };

  return (
    <div>
      <PageHeader title="Quotations" description="Tap any quotation to view, edit, convert, or download as PDF." action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="rounded-xl gap-2"><Plus className="h-4 w-4" />New quote</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader><DialogTitle>New quotation</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Client</Label>
                <ClientPicker value={clientId} onChange={setClientId} />
              </div>
              <Label>Items</Label>
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-6" placeholder="Description" value={it.description} onChange={(e) => { const n = [...items]; n[idx].description = e.target.value; setItems(n); }} />
                  <Input className="col-span-2" type="number" value={it.qty} onChange={(e) => { const n = [...items]; n[idx].qty = Number(e.target.value); setItems(n); }} />
                  <Input className="col-span-3" type="number" value={it.rate} onChange={(e) => { const n = [...items]; n[idx].rate = Number(e.target.value); setItems(n); }} />
                  <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setItems([...items, { description: "", qty: 1, rate: 0 }])}><Plus className="h-4 w-4" />Add</Button>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>GST %</Label><Input type="number" value={gstPct} onChange={(e) => setGstPct(Number(e.target.value))} /></div>
                <div className="space-y-1.5"><Label>Discount</Label><Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div>
              </div>
              <div className="rounded-xl bg-muted/40 p-3 flex justify-between font-semibold"><span>Total</span><span>{inr(total)}</span></div>
              <Button onClick={save} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />
      {!quotes.length ? <Card className="p-12 rounded-2xl border text-center text-muted-foreground">No quotations yet.</Card> : (
        <div className="space-y-2">
          {quotes.map((q: any) => (
            <Card
              key={q.id}
              onClick={() => setOpenId(q.id)}
              className="p-4 rounded-xl border cursor-pointer hover:shadow-card transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{q.quotation_number} · {q.client?.name || "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">{fmtDate(q.quote_date)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold">{inr(q.total)}</div>
                  <Badge variant="outline" className="rounded-full text-[10px] capitalize">{q.status}</Badge>
                </div>
                <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={(e) => remove(e, q.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}
      <QuotationDetailDialog quotationId={openId} open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}
