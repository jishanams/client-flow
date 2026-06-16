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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr, fmtDate, todayISO } from "@/lib/format";
import { Plus, Trash2, Pencil, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/salaries")({
  head: () => ({ meta: [{ title: "Salaries — DO Business Manager" }] }),
  component: SalariesPage,
});

type Row = {
  id?: string;
  employee_name: string;
  role: string;
  amount: number | string;
  pay_period: string;
  pay_date: string;
  status: string;
  method: string;
  notes: string;
};

const empty: Row = {
  employee_name: "", role: "", amount: "", pay_period: "",
  pay_date: todayISO(), status: "unpaid", method: "bank", notes: "",
};

function SalariesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [f, setF] = useState<Row>(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["salaries", filter],
    queryFn: async () => {
      let q = supabase.from("salaries").select("*").is("deleted_at", null).order("pay_date", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      return (await q).data ?? [];
    },
  });

  const totals = rows.reduce(
    (acc: any, r: any) => {
      const a = Number(r.amount) || 0;
      acc.total += a;
      if (r.status === "paid") acc.paid += a;
      else acc.due += a;
      return acc;
    },
    { total: 0, paid: 0, due: 0 },
  );

  const openAdd = () => { setEditing(null); setF({ ...empty }); setOpen(true); };
  const openEdit = (r: any) => {
    setEditing(r);
    setF({
      id: r.id, employee_name: r.employee_name, role: r.role || "", amount: r.amount,
      pay_period: r.pay_period || "", pay_date: r.pay_date, status: r.status,
      method: r.method || "bank", notes: r.notes || "",
    });
    setOpen(true);
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !f.employee_name) return toast.error("Employee name required");
    const payload = {
      employee_name: f.employee_name, role: f.role || null, amount: Number(f.amount) || 0,
      pay_period: f.pay_period || null, pay_date: f.pay_date, status: f.status,
      method: f.method || null, notes: f.notes || null,
    };
    const { error } = editing?.id
      ? await supabase.from("salaries").update(payload).eq("id", editing.id)
      : await supabase.from("salaries").insert({ ...payload, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success(editing ? "Updated" : "Salary added");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["salaries"] });
  };

  const togglePaid = async (r: any) => {
    const next = r.status === "paid" ? "unpaid" : "paid";
    const { error } = await supabase.from("salaries").update({ status: next }).eq("id", r.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["salaries"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Move to Trash?")) return;
    const { error } = await supabase.from("salaries").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Moved to Trash");
    qc.invalidateQueries({ queryKey: ["salaries"] });
    qc.invalidateQueries({ queryKey: ["trash", "salaries"] });
  };

  return (
    <div>
      <PageHeader
        title="Salaries"
        description="Track employee salaries — mark paid, edit, delete."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="rounded-xl gap-2" onClick={openAdd}><Plus className="h-4 w-4" />Add salary</Button></DialogTrigger>
            <DialogContent className="rounded-2xl max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit salary" : "New salary"}</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2"><Label>Employee name *</Label><Input autoFocus value={f.employee_name} onChange={(e) => setF({ ...f, employee_name: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Role</Label><Input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Pay period</Label><Input placeholder="e.g. June 2026" value={f.pay_period} onChange={(e) => setF({ ...f, pay_period: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Pay date <span className="text-[10px] text-muted-foreground font-normal">(any past month)</span></Label><Input type="date" value={f.pay_date} onChange={(e) => setF({ ...f, pay_date: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Method</Label>
                    <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Status</Label>
                    <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
                <Button type="submit" className="w-full">{editing ? "Save changes" : "Add salary"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4 rounded-xl"><div className="text-xs text-muted-foreground">Total</div><div className="text-lg font-semibold">{inr(totals.total)}</div></Card>
        <Card className="p-4 rounded-xl"><div className="text-xs text-muted-foreground">Paid</div><div className="text-lg font-semibold text-[color:var(--success)]">{inr(totals.paid)}</div></Card>
        <Card className="p-4 rounded-xl"><div className="text-xs text-muted-foreground">Due</div><div className="text-lg font-semibold text-destructive">{inr(totals.due)}</div></Card>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
        </TabsList>
      </Tabs>

      {!rows.length ? (
        <Card className="p-12 rounded-2xl border text-center text-muted-foreground">No salary records yet.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r: any) => (
            <Card key={r.id} className="p-4 rounded-xl border flex items-center gap-3 cursor-pointer hover:shadow-card transition-shadow" onClick={() => openEdit(r)}>
              <button
                onClick={(e) => { e.stopPropagation(); togglePaid(r); }}
                className="shrink-0"
                title={r.status === "paid" ? "Mark unpaid" : "Mark paid"}
              >
                {r.status === "paid"
                  ? <CheckCircle2 className="h-6 w-6 text-[color:var(--success)]" />
                  : <Circle className="h-6 w-6 text-muted-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{r.employee_name} {r.role && <span className="text-xs text-muted-foreground font-normal">· {r.role}</span>}</div>
                <div className="text-xs text-muted-foreground truncate">{r.pay_period || fmtDate(r.pay_date)} · {r.method || "—"}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold">{inr(Number(r.amount))}</div>
                <Badge variant={r.status === "paid" ? "secondary" : "destructive"} className="rounded-full text-[10px] capitalize">{r.status}</Badge>
              </div>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); remove(r.id); }}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
