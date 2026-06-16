import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, fmtDate } from "@/lib/format";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/income")({
  head: () => ({ meta: [{ title: "Income — DO Business Manager" }] }),
  component: IncomePage,
});

function IncomePage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState<string>("all");
  const { data: payments = [] } = useQuery({
    queryKey: ["payments-all"],
    queryFn: async () => (await supabase.from("payments").select("*, client:clients(name), invoice:invoices(invoice_number)").order("payment_date", { ascending: false })).data ?? [],
  });

  const allMonths = useMemo(() => {
    const s = new Set<string>();
    payments.forEach((p: any) => p.payment_date && s.add(p.payment_date.slice(0, 7)));
    s.add(new Date().toISOString().slice(0, 7));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [payments]);

  const filtered = month === "all" ? payments : payments.filter((p: any) => (p.payment_date || "").slice(0, 7) === month);
  const total = filtered.reduce((s, p: any) => s + Number(p.amount), 0);
  const fmtMonth = (m: string) => { const [y, mm] = m.split("-"); return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" }); };

  const remove = async (id: string) => {
    if (!confirm("Delete this payment entry?")) return;
    await supabase.from("payments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["payments-all"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dash-stats"] });
    toast.success("Deleted");
  };

  return (
    <div>
      <PageHeader title="Income" description="Every payment received" />
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            {allMonths.map((m) => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Card className="p-3 rounded-xl border flex-1 flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{month === "all" ? "Total" : fmtMonth(month)}</span>
          <span className="text-lg font-semibold text-[color:var(--success)]">{inr(total)}</span>
        </Card>
      </div>
      {!filtered.length ? (
        <Card className="p-12 rounded-2xl border text-center text-muted-foreground">No income in this period.</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p: any) => (
            <Card key={p.id} className="p-4 rounded-xl border flex justify-between items-center gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{p.client?.name || "—"}</div>
                <div className="text-xs text-muted-foreground">{p.invoice?.invoice_number || ""} · {fmtDate(p.payment_date)}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-semibold text-[color:var(--success)]">{inr(p.amount)}</div>
                  <Badge variant="outline" className="rounded-full text-[10px] capitalize">{p.method}</Badge>
                </div>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
