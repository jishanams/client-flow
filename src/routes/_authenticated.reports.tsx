import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — DO Business Manager" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: payments = [] } = useQuery({ queryKey: ["pay-r"], queryFn: async () => (await supabase.from("payments").select("amount, payment_date")).data ?? [] });
  const { data: expenses = [] } = useQuery({ queryKey: ["exp-r"], queryFn: async () => (await supabase.from("expenses").select("amount, expense_date, category")).data ?? [] });
  const { data: ledger = [] } = useQuery({
    queryKey: ["led-r"],
    queryFn: async () =>
      (await supabase
        .from("ledger_entries")
        .select("amount, entry_date, service_name, payment_status, client:clients(id, name)")
        .is("deleted_at", null)).data ?? [],
  });

  // Treat paid ledger entries as income too
  const incomeRows = useMemo(() => {
    const fromPay = (payments as any[]).map((p) => ({ amount: Number(p.amount), date: p.payment_date }));
    const fromLed = (ledger as any[])
      .filter((e) => e.payment_status === "paid")
      .map((e) => ({ amount: Number(e.amount), date: e.entry_date }));
    return [...fromPay, ...fromLed];
  }, [payments, ledger]);

  const allMonths = useMemo(() => {
    const s = new Set<string>();
    incomeRows.forEach((p) => p.date && s.add(p.date.slice(0, 7)));
    (expenses as any[]).forEach((e) => e.expense_date && s.add(e.expense_date.slice(0, 7)));
    s.add(new Date().toISOString().slice(0, 7));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [incomeRows, expenses]);

  const [month, setMonth] = useState<string>("all");

  const inMonth = (d?: string | null) => (month === "all" ? true : (d || "").slice(0, 7) === month);

  const filteredIncome = incomeRows.filter((p) => inMonth(p.date));
  const filteredExpenses = (expenses as any[]).filter((e) => inMonth(e.expense_date));
  const filteredLedger = (ledger as any[]).filter((e) => inMonth(e.entry_date));

  const totalIncome = filteredIncome.reduce((s, p) => s + p.amount, 0);
  const totalExpense = filteredExpenses.reduce((s, e: any) => s + Number(e.amount), 0);
  const profit = totalIncome - totalExpense;

  const byMonth: Record<string, { income: number; expense: number }> = {};
  incomeRows.forEach((p) => { const m = (p.date || "").slice(0, 7); if (!m) return; (byMonth[m] ??= { income: 0, expense: 0 }).income += p.amount; });
  (expenses as any[]).forEach((e) => { const m = (e.expense_date || "").slice(0, 7); if (!m) return; (byMonth[m] ??= { income: 0, expense: 0 }).expense += Number(e.amount); });
  const months = Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a));

  const byCat: Record<string, number> = {};
  filteredExpenses.forEach((e: any) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount); });

  // Client-wise from ledger
  const byClient: Record<string, { name: string; billed: number; paid: number; pending: number; count: number }> = {};
  filteredLedger.forEach((e: any) => {
    const k = e.client?.id || "unknown";
    const r = (byClient[k] ??= { name: e.client?.name || "Unknown", billed: 0, paid: 0, pending: 0, count: 0 });
    const amt = Number(e.amount);
    r.billed += amt; r.count += 1;
    if (e.payment_status === "paid") r.paid += amt; else r.pending += amt;
  });
  const clientRows = Object.values(byClient).sort((a, b) => b.billed - a.billed);

  // Service-wise from ledger
  const byService: Record<string, { billed: number; count: number }> = {};
  filteredLedger.forEach((e: any) => {
    const k = e.service_name || "—";
    const r = (byService[k] ??= { billed: 0, count: 0 });
    r.billed += Number(e.amount); r.count += 1;
  });
  const serviceRows = Object.entries(byService).sort(([, a], [, b]) => b.billed - a.billed);

  const fmtMonth = (m: string) => {
    const [y, mm] = m.split("-");
    return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  };

  return (
    <div>
      <PageHeader title="Reports" description="Profit & loss, client-wise & service-wise breakdowns." />

      <Card className="p-5 rounded-2xl border mb-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="font-semibold">Filter by month</h2>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-48 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              {allMonths.map((m) => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-muted/40 p-4">
            <div className="text-xs text-muted-foreground">Income</div>
            <div className="text-lg font-semibold text-[color:var(--success)] mt-1">{inr(totalIncome)}</div>
          </div>
          <div className="rounded-xl bg-muted/40 p-4">
            <div className="text-xs text-muted-foreground">Expenses</div>
            <div className="text-lg font-semibold text-destructive mt-1">{inr(totalExpense)}</div>
          </div>
          <div className="rounded-xl bg-muted/40 p-4">
            <div className="text-xs text-muted-foreground">Net profit</div>
            <div className={`text-lg font-semibold mt-1 ${profit >= 0 ? "" : "text-destructive"}`}>{inr(profit)}</div>
          </div>
        </div>
      </Card>

      <Card className="p-5 rounded-2xl border mb-5">
        <h2 className="font-semibold mb-3">Monthly P&L</h2>
        {!months.length ? <div className="text-sm text-muted-foreground">No data yet.</div> : (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-3 text-xs text-muted-foreground pb-2 border-b">
              <div>Month</div><div>Income</div><div>Expense</div><div className="text-right">Profit</div>
            </div>
            {months.map(([m, v]) => (
              <button key={m} onClick={() => setMonth(m)} className="w-full grid grid-cols-4 gap-3 text-sm py-2 border-b last:border-0 hover:bg-muted/30 rounded-lg px-2 text-left">
                <div className="font-medium">{fmtMonth(m)}</div>
                <div className="text-[color:var(--success)]">{inr(v.income)}</div>
                <div className="text-destructive">{inr(v.expense)}</div>
                <div className="font-semibold text-right">{inr(v.income - v.expense)}</div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 rounded-2xl border mb-5">
        <h2 className="font-semibold mb-3">Client-wise income {month !== "all" && <span className="text-xs text-muted-foreground font-normal">· {fmtMonth(month)}</span>}</h2>
        {!clientRows.length ? <div className="text-sm text-muted-foreground">No ledger entries.</div> : (
          <div className="space-y-2">
            <div className="grid grid-cols-5 gap-3 text-xs text-muted-foreground pb-2 border-b">
              <div className="col-span-2">Client</div><div>Billed</div><div>Paid</div><div className="text-right">Pending</div>
            </div>
            {clientRows.map((r) => (
              <div key={r.name} className="grid grid-cols-5 gap-3 text-sm py-2 border-b last:border-0">
                <div className="col-span-2 font-medium truncate">{r.name} <span className="text-xs text-muted-foreground">({r.count})</span></div>
                <div>{inr(r.billed)}</div>
                <div className="text-[color:var(--success)]">{inr(r.paid)}</div>
                <div className="text-right text-destructive">{inr(r.pending)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 rounded-2xl border mb-5">
        <h2 className="font-semibold mb-3">Service-wise income {month !== "all" && <span className="text-xs text-muted-foreground font-normal">· {fmtMonth(month)}</span>}</h2>
        {!serviceRows.length ? <div className="text-sm text-muted-foreground">No ledger entries.</div> : (
          <div className="space-y-2">
            {serviceRows.map(([s, v]) => (
              <div key={s} className="flex justify-between text-sm py-2 border-b last:border-0">
                <span>{s} <span className="text-xs text-muted-foreground">({v.count})</span></span>
                <span className="font-semibold">{inr(v.billed)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 rounded-2xl border">
        <h2 className="font-semibold mb-3">Expense by category {month !== "all" && <span className="text-xs text-muted-foreground font-normal">· {fmtMonth(month)}</span>}</h2>
        {!Object.keys(byCat).length ? <div className="text-sm text-muted-foreground">No expenses.</div> : (
          <div className="space-y-2">
            {Object.entries(byCat).sort(([, a], [, b]) => b - a).map(([c, v]) => (
              <div key={c} className="flex justify-between text-sm py-2 border-b last:border-0">
                <span className="capitalize">{c.replace("_", " ")}</span><span className="font-semibold">{inr(v)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
