import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { inr, fmtDate, todayISO } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["salary","office_rent","electricity","internet","fuel","travel","marketing","equipment","software","printing","food","miscellaneous"];

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — DO Business Manager" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<string>("all");
  const [f, setF] = useState<any>({ expense_date: todayISO(), category: "miscellaneous", amount: 0, vendor: "", notes: "" });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*").order("expense_date", { ascending: false })).data ?? [],
  });

  const allMonths = useMemo(() => {
    const s = new Set<string>();
    expenses.forEach((e: any) => e.expense_date && s.add(e.expense_date.slice(0, 7)));
    s.add(new Date().toISOString().slice(0, 7));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  const filtered = month === "all" ? expenses : expenses.filter((e: any) => (e.expense_date || "").slice(0, 7) === month);
  const total = filtered.reduce((s, e: any) => s + Number(e.amount), 0);

  const fmtMonth = (m: string) => { const [y, mm] = m.split("-"); return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" }); };

  const save = async () => {
    if (!user || !f.amount) return toast.error("Amount required");
    const { error } = await supabase.from("expenses").insert({ ...f, user_id: user.id, amount: Number(f.amount) });
    if (error) return toast.error(error.message);
    toast.success("Expense added");
    setOpen(false);
    setF({ expense_date: todayISO(), category: "miscellaneous", amount: 0, vendor: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["dash-stats"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["dash-stats"] });
  };

  return (
    <div>
      <PageHeader title="Expenses" action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="rounded-xl gap-2"><Plus className="h-4 w-4" />Add expense</Button></DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle>New expense</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Date <span className="text-[10px] text-muted-foreground font-normal">(any past month)</span></Label><Input type="date" value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Amount (₹)</Label><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Category</Label>
                <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace("_"," ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Vendor</Label><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
              <Button onClick={save} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />

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
          <span className="text-lg font-semibold">{inr(total)}</span>
        </Card>
      </div>

      {!filtered.length ? <Card className="p-12 rounded-2xl border text-center text-muted-foreground">No expenses.</Card> : (
        <div className="space-y-2">
          {filtered.map((e: any) => (
            <Card key={e.id} className="p-4 rounded-xl border flex justify-between items-center gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{e.vendor || e.category.replace("_"," ")}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(e.expense_date)}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-semibold">{inr(e.amount)}</div>
                  <Badge variant="outline" className="rounded-full text-[10px] capitalize">{e.category.replace("_"," ")}</Badge>
                </div>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
