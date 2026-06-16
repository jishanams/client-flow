import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type MouseEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClientDialog } from "@/components/ClientDialog";
import { inr } from "@/lib/format";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients — DO Business Manager" }] }),
  component: ClientsPage,
});

type ClientRow = {
  id: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  monthly_package_value: number | string | null;
};

type ClientTotals = { total: number; active: number; mrr: number };

function ClientsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");

  const { data: allClients = [] } = useQuery({
    queryKey: ["clients", "all-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id,status,monthly_package_value")
        .is("deleted_at", null);
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", status],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .is("deleted_at", null)
        .eq("status", status)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: pendingByClient = {} } = useQuery({
    queryKey: ["pending-by-client"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("client_id, total, paid_amount")
        .is("deleted_at", null)
        .neq("status", "paid");
      const map: Record<string, number> = {};
      (data ?? []).forEach((i) => {
        map[i.client_id] = (map[i.client_id] || 0) + (Number(i.total) - Number(i.paid_amount));
      });
      return map;
    },
  });

  const totals = allClients.reduce(
    (acc: ClientTotals, c: Pick<ClientRow, "status" | "monthly_package_value">) => {
      acc.total += 1;
      if (c.status === "active") acc.active += 1;
      acc.mrr += Number(c.monthly_package_value) || 0;
      return acc;
    },
    { total: 0, active: 0, mrr: 0 },
  );

  const remove = async (e: MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Move "${name}" to Trash? You can restore it later.`)) return;
    const { error } = await supabase
      .from("clients")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Moved to Trash");
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["trash", "clients"] });
  };

  const filtered = (clients as ClientRow[]).filter(
    (c) =>
      !q ||
      c.name?.toLowerCase().includes(q.toLowerCase()) ||
      c.company_name?.toLowerCase().includes(q.toLowerCase()),
  );

  if (pathname !== "/clients") return <Outlet />;

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Manage clients — tap a row to open, edit, or delete."
        action={
          <ClientDialog
            trigger={
              <Button className="rounded-xl gap-2">
                <Plus className="h-4 w-4" />
                Add client
              </Button>
            }
          />
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4 rounded-xl">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-lg font-semibold">{totals.total}</div>
        </Card>
        <Card className="p-4 rounded-xl">
          <div className="text-xs text-muted-foreground">Active</div>
          <div className="text-lg font-semibold text-[color:var(--success)]">{totals.active}</div>
        </Card>
        <Card className="p-4 rounded-xl">
          <div className="text-xs text-muted-foreground">MRR</div>
          <div className="text-lg font-semibold">{inr(totals.mrr)}</div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 h-11 rounded-xl"
          />
        </div>
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="paused">Paused</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {!filtered.length ? (
        <Card className="p-12 rounded-2xl border text-center text-muted-foreground">
          No {status} clients. Add your first client to get started.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const pending = pendingByClient[c.id] || 0;
            return (
              <Card
                key={c.id}
                className="p-4 rounded-xl border flex items-center gap-3 cursor-pointer hover:shadow-card transition-shadow"
                onClick={() => navigate({ to: "/clients/$id", params: { id: c.id } })}
              >
                <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground font-semibold shrink-0">
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {c.name}
                    {c.company_name && (
                      <span className="text-xs text-muted-foreground font-normal">
                        {" "}
                        · {c.company_name}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {inr(c.monthly_package_value)}/mo · {c.phone || c.email || "—"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {pending > 0 ? (
                    <>
                      <div className="font-semibold text-destructive">{inr(pending)}</div>
                      <Badge variant="destructive" className="rounded-full text-[10px]">
                        Pending
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="secondary" className="rounded-full text-[10px] capitalize">
                      {c.status}
                    </Badge>
                  )}
                </div>
                <ClientDialog
                  initial={c}
                  trigger={
                    <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={(e) => remove(e, c.id, c.name)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
