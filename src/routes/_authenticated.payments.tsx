import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceDetailDialog } from "@/components/InvoiceDetailDialog";
import { inr, fmtDate, todayISO } from "@/lib/format";
import { ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Payments — DO Business Manager" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const today = todayISO();
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices-pay"],
    queryFn: async () => (await supabase.from("invoices").select("*, client:clients(name)").is("deleted_at", null).order("due_date", { ascending: true })).data ?? [],
  });

  const filtered = invoices.filter((i: any) => {
    const overdue = i.status !== "paid" && i.due_date && i.due_date < today;
    if (filter === "overdue") return overdue;
    if (filter === "partial") return i.status === "partially_paid";
    if (filter === "unpaid") return i.status === "unpaid";
    if (filter === "paid") return i.status === "paid";
    if (filter === "due") return i.status !== "paid";
    return true;
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["invoices-pay"] });
    qc.invalidateQueries({ queryKey: ["dash-live"] });
    qc.invalidateQueries({ queryKey: ["due-invoices"] });
  };

  const togglePaid = async (i: any) => {
    if (!user) return;
    if (i.status === "paid") {
      // Roll back to unpaid: clear payments for this invoice
      const { error } = await supabase.from("payments").delete().eq("invoice_id", i.id);
      if (error) return toast.error(error.message);
      await supabase.from("invoices").update({ paid_amount: 0, status: "unpaid" }).eq("id", i.id);
      toast.success("Marked unpaid");
    } else {
      const balance = Number(i.total) - Number(i.paid_amount);
      if (balance <= 0) return;
      const { error } = await supabase.from("payments").insert({
        user_id: user.id, invoice_id: i.id, client_id: i.client_id,
        amount: balance, payment_date: todayISO(), method: "bank",
      });
      if (error) return toast.error(error.message);
      toast.success("Marked paid");
    }
    refresh();
  };

  return (
    <div>
      <PageHeader title="Payments" description="Tap a row to view, record a payment, or download a receipt. Tap the circle to quickly mark paid / unpaid." />
      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList className="rounded-xl flex-wrap h-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="due">Due</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="partial">Partial</TabsTrigger>
          <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
        </TabsList>
      </Tabs>
      {!filtered.length ? (
        <Card className="p-12 rounded-2xl border text-center text-muted-foreground">Nothing here.</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((i: any) => {
            const pending = Number(i.total) - Number(i.paid_amount);
            const overdue = i.status !== "paid" && i.due_date && i.due_date < today;
            const paid = i.status === "paid";
            return (
              <Card
                key={i.id}
                onClick={() => setOpenId(i.id)}
                className="p-4 rounded-xl border flex justify-between items-center gap-3 cursor-pointer hover:shadow-card transition-shadow"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); togglePaid(i); }}
                  className="shrink-0"
                  title={paid ? "Mark unpaid" : "Mark paid"}
                >
                  {paid
                    ? <CheckCircle2 className="h-6 w-6 text-[color:var(--success)]" />
                    : <Circle className="h-6 w-6 text-muted-foreground" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{i.client?.name} — {i.invoice_number}</div>
                  <div className="text-xs text-muted-foreground">Due {fmtDate(i.due_date)} · Paid {inr(i.paid_amount)} of {inr(i.total)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-semibold ${pending > 0 ? "text-destructive" : "text-[color:var(--success)]"}`}>{paid ? "Paid" : inr(pending)}</div>
                  {overdue && <Badge variant="destructive" className="rounded-full text-[10px]">Overdue</Badge>}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </Card>
            );
          })}
        </div>
      )}
      <InvoiceDetailDialog invoiceId={openId} open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}
