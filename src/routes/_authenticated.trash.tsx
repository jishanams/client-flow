import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inr, fmtDate } from "@/lib/format";
import { Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trash")({
  head: () => ({ meta: [{ title: "Trash — DO Business Manager" }] }),
  component: TrashPage,
});

type TableName = "clients" | "invoices" | "quotations" | "payments" | "tasks" | "reminders" | "expenses" | "notes" | "salaries" | "letter_templates";

const SECTIONS: { key: TableName; label: string; describe: (r: any) => string; amount?: (r: any) => string }[] = [
  { key: "clients", label: "Clients", describe: (r) => `${r.name}${r.company_name ? ` · ${r.company_name}` : ""}` },
  { key: "invoices", label: "Invoices", describe: (r) => `${r.invoice_number}`, amount: (r) => inr(r.total) },
  { key: "quotations", label: "Quotations", describe: (r) => `${r.quotation_number}`, amount: (r) => inr(r.total) },
  { key: "payments", label: "Payments", describe: (r) => `${r.method} · ${fmtDate(r.payment_date)}`, amount: (r) => inr(r.amount) },
  { key: "salaries", label: "Salaries", describe: (r) => `${r.employee_name}${r.role ? ` · ${r.role}` : ""}`, amount: (r) => inr(r.amount) },
  { key: "letter_templates", label: "Letters", describe: (r) => `${r.title} · ${r.kind}` },
  { key: "tasks", label: "Tasks", describe: (r) => r.title },
  { key: "reminders", label: "Reminders", describe: (r) => `${r.title} · ${fmtDate(r.remind_date)}` },
  { key: "expenses", label: "Expenses", describe: (r) => `${r.category}${r.vendor ? ` · ${r.vendor}` : ""}`, amount: (r) => inr(r.amount) },
  { key: "notes", label: "Notes", describe: (r) => (r.content || "").slice(0, 60) },
];

function TrashSection({ table, describe, amount }: { table: TableName; describe: (r: any) => string; amount?: (r: any) => string }) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["trash", table],
    queryFn: async () =>
      (await supabase.from(table).select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false })).data ?? [],
  });

  const restore = async (id: string) => {
    const { error } = await supabase.from(table).update({ deleted_at: null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Restored");
    qc.invalidateQueries({ queryKey: ["trash", table] });
    qc.invalidateQueries();
  };

  const purge = async (id: string) => {
    if (!confirm("Permanently delete? This cannot be undone.")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Permanently deleted");
    qc.invalidateQueries({ queryKey: ["trash", table] });
  };

  const purgeAll = async () => {
    if (!data.length) return;
    if (!confirm(`Permanently delete all ${data.length} item(s) in ${table}?`)) return;
    const ids = data.map((r: any) => r.id);
    const { error } = await supabase.from(table).delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("Emptied");
    qc.invalidateQueries({ queryKey: ["trash", table] });
  };

  if (isLoading) return <div className="text-muted-foreground text-sm py-8 text-center">Loading…</div>;
  if (!data.length) return <Card className="p-8 rounded-2xl border text-center text-muted-foreground">Nothing here.</Card>;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" className="text-destructive" onClick={purgeAll}>
          <Trash2 className="h-4 w-4" />Empty {table}
        </Button>
      </div>
      {data.map((r: any) => (
        <Card key={r.id} className="p-3 rounded-xl border flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{describe(r)}</div>
            <div className="text-xs text-muted-foreground">Deleted {fmtDate(r.deleted_at)}</div>
          </div>
          {amount && <div className="font-semibold shrink-0">{amount(r)}</div>}
          <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={() => restore(r.id)}>
            <Undo2 className="h-4 w-4" />Restore
          </Button>
          <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => purge(r.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </Card>
      ))}
    </div>
  );
}

function TrashPage() {
  return (
    <div>
      <PageHeader title="Trash" description="Deleted items live here. Restore them, or remove forever." />
      <Tabs defaultValue="clients">
        <TabsList className="rounded-xl flex-wrap h-auto">
          {SECTIONS.map((s) => (
            <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>
          ))}
        </TabsList>
        {SECTIONS.map((s) => (
          <TabsContent key={s.key} value={s.key} className="mt-4">
            <TrashSection table={s.key} describe={s.describe} amount={s.amount} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
