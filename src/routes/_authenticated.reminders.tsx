import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDate, todayISO } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({ meta: [{ title: "Reminders — DO Business Manager" }] }),
  component: RemindersPage,
});

function RemindersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ title: "", remind_date: todayISO(), remind_time: "", priority: "medium" });

  const { data: reminders = [] } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => (await supabase.from("reminders").select("*").order("remind_date", { ascending: true })).data ?? [],
  });

  const save = async () => {
    if (!user || !f.title) return;
    const { error } = await supabase.from("reminders").insert({ ...f, user_id: user.id, remind_time: f.remind_time || null });
    if (error) return toast.error(error.message);
    toast.success("Reminder added");
    setOpen(false);
    setF({ title: "", remind_date: todayISO(), remind_time: "", priority: "medium" });
    qc.invalidateQueries({ queryKey: ["reminders"] });
    qc.invalidateQueries({ queryKey: ["today-reminders"] });
  };

  const toggle = async (r: any) => {
    await supabase.from("reminders").update({ completed: !r.completed }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["reminders"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this reminder?")) return;
    await supabase.from("reminders").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["reminders"] });
    qc.invalidateQueries({ queryKey: ["today-reminders"] });
  };

  return (
    <div>
      <PageHeader title="Reminders" action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="rounded-xl gap-2"><Plus className="h-4 w-4" />Add</Button></DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle>New reminder</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={f.remind_date} onChange={(e) => setF({ ...f, remind_date: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Time</Label><Input type="time" value={f.remind_time} onChange={(e) => setF({ ...f, remind_time: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Priority</Label>
                <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem>
                </SelectContent></Select>
              </div>
              <Button onClick={save} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />
      {!reminders.length ? <Card className="p-12 rounded-2xl border text-center text-muted-foreground">No reminders.</Card> : (
        <div className="space-y-2">
          {reminders.map((r: any) => (
            <Card key={r.id} className="p-4 rounded-xl border flex items-center gap-3">
              <input type="checkbox" checked={r.completed} onChange={() => toggle(r)} className="h-5 w-5 accent-primary" />
              <div className="flex-1 min-w-0">
                <div className={r.completed ? "line-through text-muted-foreground" : "font-medium"}>{r.title}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(r.remind_date)} {r.remind_time?.slice(0, 5)}</div>
              </div>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
