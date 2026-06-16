import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { inr, fmtDate, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClientPicker } from "@/components/ClientPicker";
import { nextInvoiceNumber } from "@/lib/numbering";
import {
  TrendingUp, TrendingDown, Wallet, Users, AlertCircle, IndianRupee,
  MessageCircle, ArrowRight, Repeat, Bell, Check, Briefcase, Rocket, UserCog,
  ChevronLeft, ChevronRight, Calendar,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — DO Business Manager" }] }),
  component: Dashboard,
});

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthBounds(year: number, month: number) {
  const start = new Date(year, month, 1).toISOString().slice(0, 10);
  const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

function StatCard({
  label, value, icon: Icon, tone = "default", to, alert,
}: {
  label: string; value: string; icon: any;
  tone?: "default" | "success" | "danger" | "warning" | "info";
  to?: string; alert?: boolean;
}) {
  const toneClasses = {
    default: "bg-accent/60 text-accent-foreground",
    success: "bg-[color:var(--success)]/10 text-[color:var(--success)]",
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-[color:var(--warning)]/15 text-[color:var(--warning-foreground)]",
    info: "bg-primary/10 text-primary",
  }[tone];
  const inner = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
        <div className="mt-2 text-2xl lg:text-3xl font-semibold tracking-tight truncate">{value}</div>
      </div>
      <div className={`relative grid h-10 w-10 place-items-center rounded-xl ${toneClasses}`}>
        <Icon className="h-5 w-5" />
        {alert && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background animate-pulse" />}
      </div>
    </div>
  );
  return (
    <Card className="p-5 rounded-2xl shadow-soft hover:shadow-card transition-shadow border bg-card">
      {to ? <Link to={to}>{inner}</Link> : inner}
    </Card>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;
  const today = todayISO();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const { start: mStart, end: mEnd } = useMemo(() => monthBounds(year, month), [year, month]);
  const monthLabel = `${MONTHS[month]} ${year}`;
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  // Month-scoped stats
  const { data: mStats } = useQuery({
    queryKey: ["dash-month", userId, mStart, mEnd],
    enabled: !!userId,
    queryFn: async () => {
      const [pay, exp, sal, led] = await Promise.all([
        supabase.from("payments").select("amount").is("deleted_at", null).gte("payment_date", mStart).lte("payment_date", mEnd),
        supabase.from("expenses").select("amount").is("deleted_at", null).gte("expense_date", mStart).lte("expense_date", mEnd),
        supabase.from("salaries").select("amount, status").is("deleted_at", null).gte("pay_date", mStart).lte("pay_date", mEnd),
        supabase.from("ledger_entries").select("amount, payment_status").is("deleted_at", null).gte("entry_date", mStart).lte("entry_date", mEnd),
      ]);
      const payIncome = (pay.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const ledIncome = (led.data ?? []).filter((r: any) => r.payment_status === "paid").reduce((s, r: any) => s + Number(r.amount), 0);
      const income = payIncome + ledIncome;
      const expenses = (exp.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const salariesTotal = (sal.data ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
      const salariesDue = (sal.data ?? []).filter((r: any) => r.status !== "paid").reduce((s, r: any) => s + Number(r.amount), 0);
      return { income, expenses, salariesTotal, salariesDue };
    },
  });

  // Live (overall) stats
  const { data: live } = useQuery({
    queryKey: ["dash-live", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [inv, cli] = await Promise.all([
        supabase.from("invoices").select("total, paid_amount, due_date, status"),
        supabase.from("clients").select("id, monthly_package_value").eq("status", "active"),
      ]);
      const invoices = inv.data ?? [];
      const due = invoices.reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.paid_amount)), 0);
      const overdue = invoices.filter((i) => i.status !== "paid" && i.due_date && i.due_date < today).length;
      const clients = cli.data ?? [];
      const retainers = clients.reduce((s, c) => s + Number(c.monthly_package_value || 0), 0);
      return { due, overdue, activeClients: clients.length, retainers };
    },
  });

  const { data: dueInvoices } = useQuery({
    queryKey: ["due-invoices", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, due_date, total, paid_amount, status, client:clients(name, whatsapp, phone)")
        .neq("status", "paid")
        .order("due_date", { ascending: true })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: todayReminders = [] } = useQuery({
    queryKey: ["today-reminders", userId, today],
    enabled: !!userId,
    queryFn: async () => (await supabase
      .from("reminders").select("id, title, remind_time, priority, completed")
      .eq("remind_date", today).order("remind_time", { ascending: true })).data ?? [],
  });

  const { data: todayTasks = [] } = useQuery({
    queryKey: ["today-tasks", userId, today],
    enabled: !!userId,
    queryFn: async () => (await supabase
      .from("tasks").select("id, title, priority, status, client:clients(name)")
      .eq("due_date", today).neq("status", "completed")).data ?? [],
  });




  const toggleReminder = async (r: any) => {
    await supabase.from("reminders").update({ completed: !r.completed }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["today-reminders"] });
  };

  const income = mStats?.income ?? 0;
  const expenses = mStats?.expenses ?? 0;
  const salariesTotal = mStats?.salariesTotal ?? 0;
  const salariesDue = mStats?.salariesDue ?? 0;
  const net = income - expenses - salariesTotal;
  const alertsTotal = todayReminders.filter((r: any) => !r.completed).length + todayTasks.length + (live?.overdue ?? 0);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Track this month's income, expenses, salaries and pending work."
        action={<NewProjectButton />}
      />

      {/* ===== MONTH SWITCHER ===== */}
      <Card className="p-3 rounded-2xl border bg-card mb-4 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-xl h-9 w-9" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-2">
            <Calendar className="h-4 w-4 text-primary" />
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-9 w-[110px] rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())} className="h-9 w-24 rounded-xl" />
          </div>
          <Button variant="outline" size="icon" className="rounded-xl h-9 w-9" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{isCurrentMonth ? "Current month" : "Viewing"} · <b className="text-foreground">{monthLabel}</b></span>
          {!isCurrentMonth && (
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => { setMonth(now.getMonth()); setYear(now.getFullYear()); }}>
              Today
            </Button>
          )}
        </div>
      </Card>

      {/* ===== ALERTS / TODAY ===== */}
      <Card className="p-5 rounded-2xl border bg-card mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <Bell className="h-4 w-4" />
              {alertsTotal > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground grid place-items-center ring-2 ring-background">
                  {alertsTotal}
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold">Today · {fmtDate(today)}</h2>
          </div>
          <Link to="/reminders"><Button variant="ghost" size="sm">All <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>

        {alertsTotal === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">All clear today. 🎉</div>
        ) : (
          <div className="space-y-2">
            {(live?.overdue ?? 0) > 0 && (
              <Link to="/invoices" className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 hover:bg-destructive/15">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <div className="flex-1 text-sm font-medium text-destructive">
                  {live!.overdue} overdue invoice{live!.overdue > 1 ? "s" : ""}
                </div>
                <ArrowRight className="h-4 w-4 text-destructive" />
              </Link>
            )}
            {todayReminders.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                <button onClick={() => toggleReminder(r)} className={`h-5 w-5 rounded-md border grid place-items-center ${r.completed ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                  {r.completed && <Check className="h-3 w-3 text-primary-foreground" />}
                </button>
                <span className={
                  r.priority === "high" ? "h-2 w-2 rounded-full bg-destructive" :
                  r.priority === "medium" ? "h-2 w-2 rounded-full bg-[color:var(--warning)]" :
                  "h-2 w-2 rounded-full bg-muted-foreground"
                } />
                <div className={`flex-1 text-sm ${r.completed ? "line-through text-muted-foreground" : "font-medium"}`}>{r.title}</div>
                {r.remind_time && <div className="text-xs text-muted-foreground">{r.remind_time.slice(0, 5)}</div>}
              </div>
            ))}
            {todayTasks.map((t: any) => (
              <Link key={t.id} to="/tasks" className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60">
                <Briefcase className="h-4 w-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  {t.client?.name && <div className="text-xs text-muted-foreground">{t.client.name}</div>}
                </div>
                <Badge variant="outline" className="text-[10px]">Task</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* ===== STATS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard label={`Income · ${MONTHS[month]}`} value={inr(income)} icon={TrendingUp} tone="success" to="/income" />
        <StatCard label={`Expenses · ${MONTHS[month]}`} value={inr(expenses)} icon={TrendingDown} tone="warning" to="/expenses" />
        <StatCard label={`Salaries · ${MONTHS[month]}`} value={inr(salariesTotal)} icon={UserCog} tone="info" to="/salaries" alert={salariesDue > 0} />
        <StatCard label={`Net Profit · ${MONTHS[month]}`} value={inr(net)} icon={IndianRupee} tone={net >= 0 ? "success" : "danger"} />
        <StatCard label="Monthly Retainers" value={inr(live?.retainers ?? 0)} icon={Repeat} tone="info" to="/clients" />
        <StatCard label="Payment Due" value={inr(live?.due ?? 0)} icon={Wallet} tone="danger" to="/payments" alert={(live?.overdue ?? 0) > 0} />
        <StatCard label="Active Clients" value={String(live?.activeClients ?? 0)} icon={Users} to="/clients" />
        <StatCard label={`Salaries Due · ${MONTHS[month]}`} value={inr(salariesDue)} icon={Wallet} tone={salariesDue > 0 ? "danger" : "default"} to="/salaries" />
      </div>

      {/* ===== PAYMENT DUE ===== */}
      <div className="mt-8">
        <Card className="p-5 rounded-2xl border bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Payment Due</h2>
            <Link to="/payments"><Button variant="ghost" size="sm">All <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
          {!dueInvoices?.length ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No pending payments. 🎉</div>
          ) : (
            <div className="space-y-2">
              {dueInvoices.map((inv: any) => {
                const pending = Number(inv.total) - Number(inv.paid_amount);
                const overdue = inv.due_date && inv.due_date < today;
                const wa = inv.client?.whatsapp || inv.client?.phone;
                const msg = encodeURIComponent(
                  `Hi ${inv.client?.name || ""}, reminder for invoice ${inv.invoice_number} of ${inr(pending)}. Thanks!`,
                );
                return (
                  <Link
                    key={inv.id}
                    to="/payments"
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl hover:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{inv.client?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {inv.invoice_number} · {fmtDate(inv.due_date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="font-semibold text-sm">{inr(pending)}</div>
                        {overdue && <Badge variant="destructive" className="text-[9px]">Overdue</Badge>}
                      </div>
                      {wa && (
                        <a
                          href={`https://wa.me/${String(wa).replace(/\D/g, "")}?text=${msg}`}
                          target="_blank" rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--success)]/10 text-[color:var(--success)] hover:bg-[color:var(--success)]/20"
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function NewProjectButton() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [service, setService] = useState("");
  const [total, setTotal] = useState<number | "">("");
  const [advance, setAdvance] = useState<number | "">("");
  const [method, setMethod] = useState("bank");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setClientId(""); setService(""); setTotal(""); setAdvance("");
    setMethod("bank"); setDate(todayISO()); setNotes("");
  };

  const save = async () => {
    if (!user) return;
    if (!clientId) return toast.error("Select a client");
    if (!service.trim()) return toast.error("Enter the service/work name");
    const totalNum = Number(total) || 0;
    const advNum = Number(advance) || 0;
    if (totalNum <= 0) return toast.error("Enter a total amount");
    if (advNum > totalNum) return toast.error("Advance can't exceed total");

    setSaving(true);
    try {
      const num = await nextInvoiceNumber(user.id);
      const { data: inv, error: e1 } = await supabase.from("invoices").insert({
        user_id: user.id, client_id: clientId, invoice_number: num,
        invoice_date: date, items: [{ description: service, qty: 1, rate: totalNum }] as any,
        subtotal: totalNum, gst_amount: 0, discount: 0, total: totalNum,
        notes: notes || null,
      }).select().maybeSingle();
      if (e1) throw e1;

      if (advNum > 0 && inv) {
        const { error: e2 } = await supabase.from("payments").insert({
          user_id: user.id, invoice_id: inv.id, client_id: clientId,
          amount: advNum, payment_date: date, method, notes: "Advance for " + service,
        });
        if (e2) throw e2;
      }
      toast.success(`Project added · Balance ${inr(totalNum - advNum)}`);
      qc.invalidateQueries();
      reset(); setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const balance = (Number(total) || 0) - (Number(advance) || 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="rounded-xl gap-2 shadow-soft"><Rocket className="h-4 w-4" />New project</Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New project / work</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <ClientPicker value={clientId} onChange={setClientId} />
            <p className="text-xs text-muted-foreground">Pick an existing client or tap + to add a new one.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Service / work</Label>
            <Input placeholder="e.g. Website design, Promo video" value={service} onChange={(e) => setService(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Total amount (₹)</Label>
              <Input type="number" value={total} onChange={(e) => setTotal(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Advance received (₹)</Label>
              <Input type="number" value={advance} onChange={(e) => setAdvance(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment method</Label>
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
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="rounded-xl bg-muted/40 p-4 grid grid-cols-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Total</div><div className="font-semibold">{inr(Number(total) || 0)}</div></div>
            <div><div className="text-xs text-muted-foreground">Advance</div><div className="font-semibold text-[color:var(--success)]">{inr(Number(advance) || 0)}</div></div>
            <div><div className="text-xs text-muted-foreground">Balance</div><div className="font-semibold text-destructive">{inr(Math.max(0, balance))}</div></div>
          </div>
          <Button onClick={save} disabled={saving} className="w-full h-11 rounded-xl">
            {saving ? "Saving..." : "Create project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

