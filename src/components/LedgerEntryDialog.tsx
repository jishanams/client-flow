import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientPicker } from "@/components/ClientPicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { todayISO } from "@/lib/format";
import { SERVICE_TEMPLATES } from "@/lib/services";

type Addon = { description: string; amount: number | string };
type Entry = {
  id?: string;
  client_id?: string;
  service_name?: string;
  amount?: number | string;
  entry_date?: string;
  payment_status?: string;
  invoice_status?: string;
  notes?: string | null;
  addons?: Addon[];
};

export function LedgerEntryDialog({
  trigger, initial, clientId, open: openProp, onOpenChange, onSaved,
}: {
  trigger?: ReactNode;
  initial?: Entry;
  clientId?: string;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setOpenState(o));
  const [saving, setSaving] = useState(false);

  const empty: Entry = {
    client_id: clientId || "",
    service_name: "",
    amount: "",
    entry_date: todayISO(),
    payment_status: "pending",
    invoice_status: "none",
    notes: "",
    addons: [],
  };
  const [f, setF] = useState<Entry>(empty);
  const [tpl, setTpl] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const ad: Addon[] = Array.isArray((initial as any).addons) ? (initial as any).addons : [];
      const addonSum = ad.reduce((s, a) => s + (Number(a.amount) || 0), 0);
      const base = Math.max(0, (Number(initial.amount) || 0) - addonSum);
      setF({ ...initial, amount: base, addons: ad });
      setTpl(SERVICE_TEMPLATES.includes(initial.service_name as any) ? (initial.service_name as string) : "Custom Service");
    } else {
      setF({ ...empty, client_id: clientId || "" });
      setTpl("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, clientId]);

  const pickTpl = (v: string) => {
    setTpl(v);
    if (v && v !== "Custom Service") setF((p) => ({ ...p, service_name: v }));
    else if (v === "Custom Service") setF((p) => ({ ...p, service_name: "" }));
  };

  const cleanAddons: Addon[] = (f.addons || [])
    .map((a) => ({ description: (a.description || "").trim(), amount: Number(a.amount) || 0 }))
    .filter((a) => a.description || a.amount > 0);
  const addonsTotal = cleanAddons.reduce((s, a) => s + Number(a.amount || 0), 0);
  const grandTotal = (Number(f.amount) || 0) + addonsTotal;

  const save = async () => {
    if (!user) return;
    if (!f.client_id) return toast.error("Select a client");
    if (!f.service_name?.trim()) return toast.error("Enter the service name");
    const amt = Number(f.amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount");
    setSaving(true);
    const payload = {
      user_id: user.id,
      client_id: f.client_id,
      service_name: f.service_name.trim(),
      amount: amt + addonsTotal,
      entry_date: f.entry_date || todayISO(),
      payment_status: f.payment_status || "pending",
      invoice_status: f.invoice_status || "none",
      notes: f.notes || null,
      addons: cleanAddons,
    };
    const { error } = initial?.id
      ? await supabase.from("ledger_entries").update(payload).eq("id", initial.id)
      : await supabase.from("ledger_entries").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial?.id ? "Entry updated" : "Entry added");
    qc.invalidateQueries({ queryKey: ["ledger"] });
    qc.invalidateQueries({ queryKey: ["client-ledger"] });
    qc.invalidateQueries({ queryKey: ["dash-month"] });
    setOpen(false);
    onSaved?.();
  };

  const addAddon = () => setF((p) => ({ ...p, addons: [...(p.addons || []), { description: "", amount: "" }] }));
  const updateAddon = (i: number, patch: Partial<Addon>) =>
    setF((p) => ({ ...p, addons: (p.addons || []).map((a, idx) => (idx === i ? { ...a, ...patch } : a)) }));
  const removeAddon = (i: number) =>
    setF((p) => ({ ...p, addons: (p.addons || []).filter((_, idx) => idx !== i) }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit work entry" : "Add work entry"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!clientId && (
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <ClientPicker value={f.client_id || ""} onChange={(id) => setF({ ...f, client_id: id })} />
              <p className="text-[11px] text-muted-foreground">Pick an existing client to avoid duplicates.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Service template</Label>
            <Select value={tpl} onValueChange={pickTpl}>
              <SelectTrigger><SelectValue placeholder="Choose a service..." /></SelectTrigger>
              <SelectContent>
                {SERVICE_TEMPLATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Service name *</Label>
            <Input
              value={f.service_name || ""}
              onChange={(e) => setF({ ...f, service_name: e.target.value })}
              placeholder="e.g. Logo Design"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input type="number" value={f.amount as any} onChange={(e) => setF({ ...f, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={f.entry_date || ""} onChange={(e) => setF({ ...f, entry_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment status</Label>
              <Select value={f.payment_status} onValueChange={(v) => setF({ ...f, payment_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Invoice status</Label>
              <Select value={f.invoice_status} onValueChange={(v) => setF({ ...f, invoice_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not invoiced</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2 pt-1 border-t">
            <div className="flex items-center justify-between">
              <Label>Add-ons (extra charges)</Label>
              <Button type="button" size="sm" variant="outline" className="rounded-xl h-7" onClick={addAddon}>+ Add</Button>
            </div>
            {(f.addons || []).length === 0 && (
              <p className="text-[11px] text-muted-foreground">Optional extras billed on top of the base service (e.g. rush fee, extra revision).</p>
            )}
            {(f.addons || []).map((a, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input className="flex-1" placeholder="Description" value={a.description} onChange={(e) => updateAddon(i, { description: e.target.value })} />
                <Input className="w-28" type="number" placeholder="₹" value={a.amount as any} onChange={(e) => updateAddon(i, { amount: e.target.value })} />
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeAddon(i)}>×</Button>
              </div>
            ))}
            {addonsTotal > 0 && (
              <div className="text-xs text-muted-foreground flex justify-between pt-1">
                <span>Add-ons total</span><span>₹{addonsTotal.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="text-sm font-semibold flex justify-between border-t pt-2">
              <span>Grand total</span><span>₹{grandTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={f.notes || ""} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
