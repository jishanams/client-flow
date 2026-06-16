import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export function ClientDialog({
  trigger, initial, onSaved, open: openProp, onOpenChange,
}: {
  trigger?: ReactNode;
  initial?: Record<string, any>;
  onSaved?: (client: Record<string, any>) => void;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => { onOpenChange ? onOpenChange(o) : setOpenState(o); };
  const [saving, setSaving] = useState(false);
  const empty = {
    name: "", company_name: "", phone: "", whatsapp: "", email: "",
    address: "", gst_number: "", monthly_package_value: 0, start_date: "",
    notes: "", status: "active",
  };
  const [f, setF] = useState<Record<string, any>>(empty);

  const { data: existing = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () =>
      (await supabase.from("clients").select("id, name").is("deleted_at", null)).data ?? [],
    enabled: open,
  });

  const duplicate = useMemo(() => {
    if (!f.name?.trim() || initial?.id) return null;
    const n = f.name.trim().toLowerCase();
    return (existing as Record<string, any>[]).find((c) => c.name?.toLowerCase() === n) || null;
  }, [f.name, existing, initial?.id]);

  useEffect(() => {
    if (open && initial) setF({ ...initial, monthly_package_value: initial.monthly_package_value ?? 0 });
    if (open && !initial) setF(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const save = async () => {
    if (!user || !f.name?.trim()) return toast.error("Client name is required");
    setSaving(true);
    const payload = {
      ...f,
      user_id: user.id,
      monthly_package_value: Number(f.monthly_package_value) || 0,
      start_date: f.start_date || null,
    };
    const { data, error } = initial?.id
      ? await supabase.from("clients").update(payload).eq("id", initial.id).select().maybeSingle()
      : await supabase.from("clients").insert(payload).select().maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial?.id ? "Client updated" : "Client added");
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["clients-min"] });
    qc.invalidateQueries({ queryKey: ["client", initial?.id] });
    qc.invalidateQueries({ queryKey: ["dash-stats"] });
    setOpen(false);
    onSaved?.(data);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit client" : "Add client"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Client name *</Label>
              <Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              {duplicate && (
                <div className="flex items-start gap-2 rounded-lg border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 px-3 py-2 text-xs">
                  <AlertCircle className="h-4 w-4 text-[color:var(--warning-foreground)] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    A client named <b>{duplicate.name}</b> already exists. Add work under that client instead of creating a duplicate.
                  </div>
                  <Button type="button" size="sm" variant="outline" className="rounded-lg h-7"
                    onClick={() => { setOpen(false); onSaved?.(duplicate); }}>
                    Use existing
                  </Button>
                </div>
              )}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Company</Label>
              <Input value={f.company_name ?? ""} onChange={(e) => setF({ ...f, company_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input value={f.whatsapp ?? ""} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Textarea rows={2} value={f.address ?? ""} onChange={(e) => setF({ ...f, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>GST number</Label>
              <Input value={f.gst_number ?? ""} onChange={(e) => setF({ ...f, gst_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly package (₹)</Label>
              <Input type="number" value={f.monthly_package_value} onChange={(e) => setF({ ...f, monthly_package_value: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={f.start_date ?? ""} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save (Enter)"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
