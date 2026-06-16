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
import { fmtDate } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks — DO Business Manager" }] }),
  component: TasksPage,
});

function TasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ title: "", description: "", due_date: "", priority: "medium", status: "pending", client_id: "" });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", filter],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*, client:clients(name)").order("due_date", { ascending: true });
      if (filter !== "all") q = q.eq("status", filter);
      return (await q).data ?? [];
    },
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name").neq("status", "archived")).data ?? [],
  });

  const save = async () => {
    if (!user || !f.title) return toast.error("Title required");
    const { error } = await supabase.from("tasks").insert({
      ...f, user_id: user.id,
      due_date: f.due_date || null, client_id: f.client_id || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Task added");
    setOpen(false);
    setF({ title: "", description: "", due_date: "", priority: "medium", status: "pending", client_id: "" });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("tasks").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await supabase.from("tasks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  return (
    <div>
      <PageHeader title="Tasks" action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="rounded-xl gap-2"><Plus className="h-4 w-4" />Add task</Button></DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Client</Label>
                <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select client (optional)" /></SelectTrigger>
                  <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Priority</Label>
                  <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem>
                  </SelectContent></Select>
                </div>
              </div>
              <Button onClick={save} className="w-full">Add task</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />

      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList className="rounded-xl flex-wrap h-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="in_progress">In progress</TabsTrigger>
          <TabsTrigger value="waiting_client">Waiting</TabsTrigger>
          <TabsTrigger value="completed">Done</TabsTrigger>
        </TabsList>
      </Tabs>

      {!tasks.length ? (
        <Card className="p-12 rounded-2xl border text-center text-muted-foreground">No tasks.</Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((t: any) => (
            <Card key={t.id} className="p-4 rounded-xl border flex items-center gap-3 flex-wrap">
              <input type="checkbox" checked={t.status === "completed"} onChange={() => updateStatus(t.id, t.status === "completed" ? "pending" : "completed")} className="h-5 w-5 accent-primary" />
              <div className="flex-1 min-w-0">
                <div className={t.status === "completed" ? "line-through text-muted-foreground" : "font-medium"}>{t.title}</div>
                <div className="text-xs text-muted-foreground truncate">{t.client?.name || "—"} · {fmtDate(t.due_date)}</div>
              </div>
              <Badge variant={t.priority === "high" ? "destructive" : "secondary"} className="rounded-full capitalize">{t.priority}</Badge>
              <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v)}>
                <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="waiting_client">Waiting</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
