import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { inr, fmtDate, todayISO } from "@/lib/format";
import { downloadDocPdf } from "@/lib/pdf";
import { Download, Trash2, ArrowRightLeft, Pencil, Save, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { nextInvoiceNumber } from "@/lib/numbering";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function QuotationDetailDialog({
  quotationId, open, onOpenChange,
}: {
  quotationId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: q } = useQuery({
    queryKey: ["quotation-detail", quotationId],
    enabled: !!quotationId && open,
    queryFn: async () =>
      (await supabase.from("quotations").select("*, client:clients(*)").eq("id", quotationId!).maybeSingle()).data,
  });

  const { data: settings } = useQuery({
    queryKey: ["company-settings", user?.id],
    enabled: !!user && open,
    queryFn: async () =>
      (await supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle()).data ?? {},
  });

  if (!q) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-2xl max-w-2xl">
          <DialogHeader><DialogTitle>Loading…</DialogTitle></DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["quotations"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["quotation-detail", quotationId] });
  };

  const download = () =>
    downloadDocPdf(
      {
        kind: "quotation", number: q.quotation_number, date: q.quote_date,
        items: (q.items as any) || [], subtotal: Number(q.subtotal),
        discount: Number(q.discount), gst_amount: Number(q.gst_amount),
        total: Number(q.total), notes: q.notes,
      },
      settings || {}, q.client || { name: "Client" },
    );

  const convert = async () => {
    if (!user || !q.client_id) return toast.error("Quotation needs a client");
    const num = await nextInvoiceNumber(user.id);
    const { error } = await supabase.from("invoices").insert({
      user_id: user.id, client_id: q.client_id, invoice_number: num,
      invoice_date: todayISO(), items: q.items, subtotal: q.subtotal,
      gst_amount: q.gst_amount, discount: q.discount, total: q.total,
    });
    if (error) return toast.error(error.message);
    await supabase.from("quotations").update({ status: "converted" }).eq("id", q.id);
    toast.success("Converted to invoice");
    refresh();
    onOpenChange(false);
  };

  const remove = async () => {
    if (!confirm("Move this quotation to Trash?")) return;
    const { error } = await supabase.from("quotations").update({ deleted_at: new Date().toISOString() }).eq("id", q.id);
    if (error) return toast.error(error.message);
    toast.success("Moved to Trash");
    refresh();
    qc.invalidateQueries({ queryKey: ["trash", "quotations"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {q.quotation_number}
            <Badge variant="outline" className="rounded-full text-[10px] capitalize">{q.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-muted/40">
            <div>
              <div className="text-xs text-muted-foreground">Client</div>
              <div className="font-semibold">{q.client?.name || "—"}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-xl font-semibold">{inr(Number(q.total))}</div>
              <div className="text-xs text-muted-foreground">{fmtDate(q.quote_date)}</div>
            </div>
          </div>

          <QuotationItemsEditor q={q} onSaved={refresh} />

          <div className="flex flex-wrap gap-2 items-center">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
            <Select
              value={q.status}
              onValueChange={async (v) => {
                const { error } = await supabase.from("quotations").update({ status: v }).eq("id", q.id);
                if (error) return toast.error(error.message);
                toast.success("Status updated");
                refresh();
              }}
            >
              <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={download} variant="outline" className="rounded-xl gap-1">
              <Download className="h-4 w-4" />Download PDF
            </Button>
            {q.status !== "converted" && (
              <Button onClick={convert} variant="outline" className="rounded-xl gap-1">
                <ArrowRightLeft className="h-4 w-4" />Convert to invoice
              </Button>
            )}
            <Button onClick={remove} variant="ghost" className="rounded-xl gap-1 text-destructive ml-auto">
              <Trash2 className="h-4 w-4" />Delete
            </Button>
          </div>

          {q.notes && (
            <div className="text-sm">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes</Label>
              <div className="mt-1 text-muted-foreground">{q.notes}</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuotationItemsEditor({ q, onSaved }: { q: any; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<any[]>(() => (q.items as any[]) || []);
  const [gstPct, setGstPct] = useState<number>(() => {
    const sub = Number(q.subtotal) || 0;
    const disc = Number(q.discount) || 0;
    const base = sub - disc;
    return base > 0 ? Math.round((Number(q.gst_amount) / base) * 100) : 18;
  });
  const [discount, setDiscount] = useState<number>(Number(q.discount) || 0);
  const [saving, setSaving] = useState(false);

  const start = () => {
    setItems((q.items as any[]) || []);
    setDiscount(Number(q.discount) || 0);
    setEditing(true);
  };

  const subtotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.rate || 0), 0);
  const gstAmount = Math.max(0, ((subtotal - discount) * gstPct) / 100);
  const total = subtotal - discount + gstAmount;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("quotations").update({
      items: items as any, subtotal, gst_amount: gstAmount, discount, total,
    }).eq("id", q.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Quotation updated");
    setEditing(false);
    onSaved();
  };

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Items</Label>
          <Button size="sm" variant="ghost" className="gap-1" onClick={start}>
            <Pencil className="h-3.5 w-3.5" />Edit
          </Button>
        </div>
        <div className="mt-2 rounded-xl border divide-y">
          {((q.items as any[]) || []).map((it, i) => (
            <div key={i} className="p-3 flex items-center gap-3 text-sm">
              <div className="flex-1">{it.description || "—"}</div>
              <div className="text-muted-foreground text-xs">{it.qty} × {inr(it.rate)}</div>
              <div className="font-medium w-24 text-right">{inr(Number(it.qty) * Number(it.rate))}</div>
            </div>
          ))}
          {!((q.items as any[]) || []).length && (
            <div className="p-3 text-sm text-muted-foreground">No items</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border p-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Editing items</Label>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
      </div>
      {items.map((it, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2">
          <Input className="col-span-6" placeholder="Description" value={it.description || ""} onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], description: e.target.value }; setItems(n); }} />
          <Input className="col-span-2" type="number" value={it.qty} onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], qty: Number(e.target.value) }; setItems(n); }} />
          <Input className="col-span-3" type="number" value={it.rate} onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], rate: Number(e.target.value) }; setItems(n); }} />
          <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setItems([...items, { description: "", qty: 1, rate: 0 }])}>
        <Plus className="h-4 w-4" />Add item
      </Button>
      <div className="grid grid-cols-2 gap-2 pt-2">
        <div><Label className="text-xs">GST %</Label><Input type="number" value={gstPct} onChange={(e) => setGstPct(Number(e.target.value))} /></div>
        <div><Label className="text-xs">Discount</Label><Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div>
      </div>
      <div className="flex justify-between text-sm pt-1"><span className="text-muted-foreground">New total</span><span className="font-semibold">{inr(total)}</span></div>
      <Button size="sm" onClick={save} disabled={saving} className="w-full gap-1"><Save className="h-4 w-4" />{saving ? "Saving…" : "Save changes"}</Button>
    </div>
  );
}
