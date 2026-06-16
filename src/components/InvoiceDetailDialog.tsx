import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { inr, fmtDate, todayISO } from "@/lib/format";
import { downloadDocPdf, downloadReceiptPdf } from "@/lib/pdf";
import {
  Download, Receipt, Trash2, CheckCircle2, MessageCircle, Plus, Pencil, Save, X,
} from "lucide-react";
import { toast } from "sonner";

export function InvoiceDetailDialog({
  invoiceId, open, onOpenChange,
}: {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: invoice } = useQuery({
    queryKey: ["invoice-detail", invoiceId],
    enabled: !!invoiceId && open,
    queryFn: async () =>
      (await supabase.from("invoices").select("*, client:clients(*)").eq("id", invoiceId!).maybeSingle()).data,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["invoice-payments", invoiceId],
    enabled: !!invoiceId && open,
    queryFn: async () =>
      (await supabase.from("payments").select("*").eq("invoice_id", invoiceId!).order("payment_date", { ascending: false })).data ?? [],
  });

  const { data: settings } = useQuery({
    queryKey: ["company-settings", user?.id],
    enabled: !!user && open,
    queryFn: async () =>
      (await supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle()).data ?? {},
  });

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [date, setDate] = useState(todayISO());
  const [adding, setAdding] = useState(false);

  if (!invoice) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-2xl max-w-2xl">
          <DialogHeader><DialogTitle>Loading…</DialogTitle></DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const total = Number(invoice.total);
  const paid = Number(invoice.paid_amount);
  const balance = Math.max(0, total - paid);
  const wa = (invoice.client?.whatsapp || invoice.client?.phone || "").replace(/\D/g, "");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
    qc.invalidateQueries({ queryKey: ["invoice-payments", invoiceId] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["invoices-pay"] });
    qc.invalidateQueries({ queryKey: ["dash-live"] });
    qc.invalidateQueries({ queryKey: ["due-invoices"] });
    qc.invalidateQueries({ queryKey: ["dash-month"] });
  };

  const addPayment = async () => {
    if (!user) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter amount");
    setAdding(true);
    const { error } = await supabase.from("payments").insert({
      user_id: user.id, invoice_id: invoice.id, client_id: invoice.client_id,
      amount: amt, payment_date: date, method,
    });
    setAdding(false);
    if (error) return toast.error(error.message);
    toast.success("Payment recorded");
    setAmount("");
    refresh();
  };

  const markFullyPaid = async () => {
    if (!user || balance <= 0) return;
    const { error } = await supabase.from("payments").insert({
      user_id: user.id, invoice_id: invoice.id, client_id: invoice.client_id,
      amount: balance, payment_date: todayISO(), method: "bank",
    });
    if (error) return toast.error(error.message);
    toast.success("Marked paid");
    refresh();
  };

  const deleteInvoice = async () => {
    if (!confirm("Move this invoice to Trash? You can restore it later.")) return;
    const { error } = await supabase.from("invoices").update({ deleted_at: new Date().toISOString() }).eq("id", invoice.id);
    if (error) return toast.error(error.message);
    toast.success("Moved to Trash");
    refresh();
    qc.invalidateQueries({ queryKey: ["trash", "invoices"] });
    onOpenChange(false);
  };

  const deletePayment = async (id: string) => {
    if (!confirm("Move this payment to Trash?")) return;
    const { error } = await supabase.from("payments").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Moved to Trash");
    refresh();
    qc.invalidateQueries({ queryKey: ["trash", "payments"] });
  };

  const downloadInvoice = () =>
    downloadDocPdf(
      {
        kind: "invoice", number: invoice.invoice_number, date: invoice.invoice_date,
        due_date: invoice.due_date, items: (invoice.items as any) || [],
        subtotal: Number(invoice.subtotal), discount: Number(invoice.discount),
        gst_amount: Number(invoice.gst_amount), total, paid_amount: paid, notes: invoice.notes,
      },
      settings || {}, invoice.client || { name: "Client" },
    );

  const downloadReceipt = (p: any) =>
    downloadReceiptPdf(
      {
        receipt_number: `RCP-${String(p.id).slice(0, 8).toUpperCase()}`,
        payment_date: p.payment_date, amount: Number(p.amount), method: p.method, notes: p.notes,
        invoice_number: invoice.invoice_number, invoice_total: total, invoice_paid_total: paid,
      },
      settings || {}, invoice.client || { name: "Client" },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {invoice.invoice_number}
            <Badge
              variant={invoice.status === "paid" ? "secondary" : invoice.status === "partially_paid" ? "outline" : "destructive"}
              className="rounded-full text-[10px] capitalize"
            >
              {invoice.status.replace("_", " ")}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client + totals */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-muted/40">
            <div>
              <div className="text-xs text-muted-foreground">Client</div>
              <div className="font-semibold">{invoice.client?.name || "—"}</div>
              {invoice.client?.company_name && <div className="text-xs text-muted-foreground">{invoice.client.company_name}</div>}
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className={`text-xl font-semibold ${balance > 0 ? "text-destructive" : "text-[color:var(--success)]"}`}>{inr(balance)}</div>
              <div className="text-xs text-muted-foreground">Paid {inr(paid)} of {inr(total)}</div>
            </div>
            <div className="text-xs text-muted-foreground">Invoice date<br /><span className="text-foreground text-sm">{fmtDate(invoice.invoice_date)}</span></div>
            <div className="text-xs text-muted-foreground text-right">Due date<br /><span className="text-foreground text-sm">{invoice.due_date ? fmtDate(invoice.due_date) : "—"}</span></div>
          </div>

          {/* Items (editable) */}
          <InvoiceItemsEditor invoice={invoice} onSaved={refresh} />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={downloadInvoice} variant="outline" className="rounded-xl gap-1">
              <Download className="h-4 w-4" />Invoice PDF
            </Button>
            {balance > 0 && (
              <Button onClick={markFullyPaid} variant="outline" className="rounded-xl gap-1">
                <CheckCircle2 className="h-4 w-4" />Mark fully paid
              </Button>
            )}
            {wa && balance > 0 && (
              <a
                href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hi ${invoice.client?.name || ""}, invoice ${invoice.invoice_number} of ${inr(balance)} is pending. Thanks!`)}`}
                target="_blank" rel="noreferrer"
                className="inline-flex h-9 items-center gap-1 rounded-xl border px-3 text-sm text-[color:var(--success)] hover:bg-[color:var(--success)]/10"
              >
                <MessageCircle className="h-4 w-4" />Remind
              </a>
            )}
            <Button onClick={deleteInvoice} variant="ghost" className="rounded-xl gap-1 text-destructive ml-auto">
              <Trash2 className="h-4 w-4" />Delete
            </Button>
          </div>

          {/* Record payment */}
          {balance > 0 && (
            <div className="rounded-xl border p-4 space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Record a payment <span className="normal-case tracking-normal text-[10px]">— date controls which month it counts under</span></Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Input type="number" placeholder={`Up to ${balance}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addPayment} disabled={adding} className="gap-1">
                  <Plus className="h-4 w-4" />Add
                </Button>
              </div>
            </div>
          )}

          {/* Payments list */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Payments ({payments.length})</Label>
            {!payments.length ? (
              <div className="mt-2 text-sm text-muted-foreground p-4 rounded-xl border text-center">No payments yet</div>
            ) : (
              <div className="mt-2 space-y-1.5">
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 p-3 rounded-xl border">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{inr(Number(p.amount))} · <span className="capitalize text-muted-foreground">{p.method}</span></div>
                      <div className="text-xs text-muted-foreground">{fmtDate(p.payment_date)}</div>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={() => downloadReceipt(p)}>
                      <Receipt className="h-4 w-4" />Receipt
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => deletePayment(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {invoice.notes && (
            <div className="text-sm">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes</Label>
              <div className="mt-1 text-muted-foreground">{invoice.notes}</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceItemsEditor({ invoice, onSaved }: { invoice: any; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<any[]>(() => (invoice.items as any[]) || []);
  const [gstPct, setGstPct] = useState<number>(() => {
    const sub = Number(invoice.subtotal) || 0;
    const disc = Number(invoice.discount) || 0;
    const base = sub - disc;
    return base > 0 ? Math.round((Number(invoice.gst_amount) / base) * 100) : 18;
  });
  const [discount, setDiscount] = useState<number>(Number(invoice.discount) || 0);
  const [notes, setNotes] = useState<string>(invoice.notes || "");
  const [saving, setSaving] = useState(false);

  const start = () => {
    setItems((invoice.items as any[]) || []);
    setDiscount(Number(invoice.discount) || 0);
    setNotes(invoice.notes || "");
    setEditing(true);
  };

  const subtotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.rate || 0), 0);
  const gstAmount = Math.max(0, ((subtotal - discount) * gstPct) / 100);
  const total = subtotal - discount + gstAmount;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("invoices").update({
      items: items as any, subtotal, gst_amount: gstAmount, discount, total, notes,
    }).eq("id", invoice.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice updated");
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
          {((invoice.items as any[]) || []).map((it, i) => (
            <div key={i} className="p-3 flex items-center gap-3 text-sm">
              <div className="flex-1">{it.description || "—"}</div>
              <div className="text-muted-foreground text-xs">{it.qty} × {inr(it.rate)}</div>
              <div className="font-medium w-24 text-right">{inr(Number(it.qty) * Number(it.rate))}</div>
            </div>
          ))}
          {!(invoice.items as any[])?.length && (
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
      <div><Label className="text-xs">Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="flex justify-between text-sm pt-1"><span className="text-muted-foreground">New total</span><span className="font-semibold">{inr(total)}</span></div>
      <Button size="sm" onClick={save} disabled={saving} className="w-full gap-1"><Save className="h-4 w-4" />{saving ? "Saving…" : "Save changes"}</Button>
    </div>
  );
}
