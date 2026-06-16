import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LedgerEntryDialog } from "@/components/LedgerEntryDialog";
import { inr, fmtDate } from "@/lib/format";
import { nextInvoiceNumber } from "@/lib/numbering";
import { Plus, Pencil, Trash2, FileText, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ledger")({
  head: () => ({ meta: [{ title: "Client Ledger — DO Business Manager" }] }),
  component: LedgerPage,
});

function LedgerPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: entries = [] } = useQuery({
    queryKey: ["ledger", "all"],
    queryFn: async () =>
      (await supabase
        .from("ledger_entries")
        .select("*, client:clients(id, name)")
        .is("deleted_at", null)
        .order("entry_date", { ascending: false })).data ?? [],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () =>
      (await supabase.from("clients").select("id, name").is("deleted_at", null).order("name")).data ?? [],
  });

  const filtered = useMemo(() => {
    return (entries as any[]).filter((e) => {
      if (filterClient !== "all" && e.client_id !== filterClient) return false;
      if (filterStatus !== "all" && e.payment_status !== filterStatus) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!`${e.service_name} ${e.client?.name || ""}`.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [entries, filterClient, filterStatus, q]);

  const totals = filtered.reduce(
    (acc, e: any) => {
      const amt = Number(e.amount);
      acc.billed += amt;
      if (e.payment_status === "paid") acc.paid += amt;
      else acc.pending += amt;
      return acc;
    },
    { billed: 0, paid: 0, pending: 0 },
  );

  const remove = async (id: string) => {
    if (!confirm("Delete this work entry?")) return;
    const { error } = await supabase.from("ledger_entries").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["ledger"] });
    qc.invalidateQueries({ queryKey: ["client-ledger"] });
  };

  const generateInvoice = async (e: any) => {
    if (!user) return;
    try {
      const num = await nextInvoiceNumber(user.id);
      const amt = Number(e.amount);
      const { data: inv, error } = await supabase
        .from("invoices")
        .insert({
          user_id: user.id,
          client_id: e.client_id,
          invoice_number: num,
          invoice_date: e.entry_date,
          items: [{ description: e.service_name, qty: 1, rate: amt }] as any,
          subtotal: amt,
          gst_amount: 0,
          discount: 0,
          total: amt,
          paid_amount: e.payment_status === "paid" ? amt : 0,
          status: e.payment_status === "paid" ? "paid" : "unpaid",
          notes: e.notes,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      await supabase
        .from("ledger_entries")
        .update({ invoice_id: inv?.id, invoice_status: "draft" })
        .eq("id", e.id);
      toast.success(`Invoice ${num} created`);
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["client-ledger"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Client Ledger"
        description="All client work entries in one place."
        action={
          <Button className="rounded-xl gap-2" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Add work entry
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4 rounded-xl"><div className="text-xs text-muted-foreground">Billed</div><div className="text-lg font-semibold">{inr(totals.billed)}</div></Card>
        <Card className="p-4 rounded-xl"><div className="text-xs text-muted-foreground">Paid</div><div className="text-lg font-semibold text-[color:var(--success)]">{inr(totals.paid)}</div></Card>
        <Card className="p-4 rounded-xl"><div className="text-xs text-muted-foreground">Pending</div><div className="text-lg font-semibold text-destructive">{inr(totals.pending)}</div></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search service or client..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-10 h-10 rounded-xl" />
        </div>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder="All clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {(clients as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!filtered.length ? (
        <Card className="p-12 rounded-2xl text-center text-muted-foreground">No work entries yet. Add your first.</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((e: any) => (
            <Card key={e.id} className="p-4 rounded-xl border">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{e.service_name}</span>
                    <Badge variant={e.payment_status === "paid" ? "secondary" : "destructive"} className="rounded-full text-[10px] capitalize">{e.payment_status}</Badge>
                    {e.invoice_status !== "none" && (
                      <Badge variant="outline" className="rounded-full text-[10px] capitalize">Inv: {e.invoice_status}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <Link to="/clients/$id" params={{ id: e.client_id }} className="hover:text-foreground">{e.client?.name || "—"}</Link>
                    {" · "}{fmtDate(e.entry_date)}
                  </div>
                  {e.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{e.notes}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold">{inr(e.amount)}</div>
                </div>
                <div className="flex gap-1 w-full sm:w-auto justify-end">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }} title="Edit"><Pencil className="h-4 w-4" /></Button>
                  {!e.invoice_id && (
                    <Button size="icon" variant="ghost" onClick={() => generateInvoice(e)} title="Generate invoice"><FileText className="h-4 w-4" /></Button>
                  )}
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(e.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <LedgerEntryDialog open={open} onOpenChange={setOpen} initial={editing} />
    </div>
  );
}
