import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClientDialog } from "@/components/ClientDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, fmtDate, todayISO } from "@/lib/format";
import { downloadReceiptPdf, downloadDocPdf } from "@/lib/pdf";
import { InvoiceDetailDialog } from "@/components/InvoiceDetailDialog";
import { LedgerEntryDialog } from "@/components/LedgerEntryDialog";
import { nextInvoiceNumber } from "@/lib/numbering";
import { toast } from "sonner";
import { ArrowLeft, Pencil, MessageCircle, Phone, Mail, Plus, Trash2, Download, ChevronRight, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  component: ClientProfile,
});

function ClientProfile() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });


  const { data: invoices = [] } = useQuery({
    queryKey: ["client-invoices", id],
    queryFn: async () => (await supabase.from("invoices").select("*").eq("client_id", id).is("deleted_at", null).order("invoice_date", { ascending: false })).data ?? [],
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["client-payments", id],
    queryFn: async () => (await supabase.from("payments").select("*").eq("client_id", id).is("deleted_at", null).order("payment_date", { ascending: false })).data ?? [],
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["client-notes", id],
    queryFn: async () => (await supabase.from("notes").select("*").eq("client_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ["client-ledger", id],
    queryFn: async () => (await supabase.from("ledger_entries").select("*").eq("client_id", id).is("deleted_at", null).order("entry_date", { ascending: false })).data ?? [],
  });

  const totalRevenue = payments.reduce((s, p: any) => s + Number(p.amount), 0);
  const pending = invoices.reduce((s, i: any) => s + Math.max(0, Number(i.total) - Number(i.paid_amount)), 0);

  const moveToTrash = async () => {
    if (!client) return;
    if (!confirm(`Move ${client.name} to Trash? You can restore later.`)) return;
    await supabase.from("clients").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    toast.success("Moved to Trash");
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["trash", "clients"] });
    navigate({ to: "/clients" });
  };

  const [newNote, setNewNote] = useState("");
  const [openInvId, setOpenInvId] = useState<string | null>(null);
  const addNote = async () => {
    if (!newNote.trim() || !user) return;
    await supabase.from("notes").insert({ user_id: user.id, client_id: id, content: newNote });
    setNewNote("");
    toast.success("Note added");
    qc.invalidateQueries({ queryKey: ["client-notes", id] });
  };

  if (!client) return <div className="text-muted-foreground">Loading...</div>;

  const waNum = (client.whatsapp || client.phone || "").replace(/\D/g, "");

  return (
    <div>
      <button onClick={() => navigate({ to: "/clients" })} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Clients
      </button>

      <Card className="p-5 rounded-2xl border shadow-soft mb-5">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-foreground font-semibold text-lg shrink-0">
            {client.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold truncate">{client.name}</h1>
            <p className="text-sm text-muted-foreground">{client.company_name || "—"}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge variant="secondary" className="rounded-full capitalize">{client.status}</Badge>
              <Badge variant="outline" className="rounded-full">{inr(client.monthly_package_value)}/mo</Badge>
            </div>
          </div>
          <div className="flex gap-1">
            <ClientDialog
              initial={client}
              trigger={<Button variant="ghost" size="icon" className="rounded-xl"><Pencil className="h-4 w-4" /></Button>}
            />
            <Button variant="ghost" size="icon" className="rounded-xl text-destructive" onClick={moveToTrash} aria-label="Delete client"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t">
          <a href={waNum ? `https://wa.me/${waNum}` : "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-primary"><MessageCircle className="h-4 w-4" />WhatsApp</a>
          <a href={client.phone ? `tel:${client.phone}` : "#"} className="flex items-center gap-2 text-sm hover:text-primary"><Phone className="h-4 w-4" />Call</a>
          <a href={client.email ? `mailto:${client.email}` : "#"} className="flex items-center gap-2 text-sm hover:text-primary"><Mail className="h-4 w-4" />Email</a>
          <div className="text-sm"><span className="text-muted-foreground">GST: </span>{client.gst_number || "—"}</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t">
          <div><div className="text-xs text-muted-foreground">Billed</div><div className="font-semibold">{inr(ledger.reduce((s: number, e: any) => s + Number(e.amount), 0))}</div></div>
          <div><div className="text-xs text-muted-foreground">Paid</div><div className="font-semibold text-[color:var(--success)]">{inr(ledger.filter((e: any) => e.payment_status === "paid").reduce((s: number, e: any) => s + Number(e.amount), 0))}</div></div>
          <div><div className="text-xs text-muted-foreground">Pending</div><div className="font-semibold text-destructive">{inr(ledger.filter((e: any) => e.payment_status !== "paid").reduce((s: number, e: any) => s + Number(e.amount), 0))}</div></div>
          <div><div className="text-xs text-muted-foreground">Projects</div><div className="font-semibold">{ledger.length}</div></div>
          <div><div className="text-xs text-muted-foreground">Last work</div><div className="font-semibold">{ledger[0] ? fmtDate(ledger[0].entry_date) : "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Since</div><div className="font-semibold">{fmtDate(client.start_date)}</div></div>
        </div>
      </Card>

      <Tabs defaultValue="ledger">
        <TabsList className="rounded-xl flex-wrap h-auto">
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="mt-4">
          <ClientLedger clientId={id} entries={ledger} />
        </TabsContent>






        <TabsContent value="invoices" className="mt-4">
          {!invoices.length ? <Empty label="No invoices yet" /> : (
            <div className="space-y-2">
              {invoices.map((i: any) => (
                <Card key={i.id} className="p-4 rounded-xl border hover:shadow-card transition-shadow cursor-pointer" onClick={() => setOpenInvId(i.id)}>
                  <div className="flex justify-between gap-3 items-start">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{i.invoice_number}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(i.invoice_date)} · Due {fmtDate(i.due_date)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold">{inr(i.total)}</div>
                      <Badge variant={i.status === "paid" ? "secondary" : "destructive"} className="rounded-full capitalize text-[10px]">{i.status.replace("_", " ")}</Badge>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={() => setOpenInvId(i.id)}>
                      <Pencil className="h-4 w-4" />Edit
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={async () => {
                      if (!user) return;
                      const { data: s } = await supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle();
                      await downloadDocPdf({ kind: "invoice", number: i.invoice_number, date: i.invoice_date, due_date: i.due_date, items: i.items || [], subtotal: Number(i.subtotal), discount: Number(i.discount), gst_amount: Number(i.gst_amount), total: Number(i.total), paid_amount: Number(i.paid_amount), notes: i.notes }, s || {}, client);
                    }}><Download className="h-4 w-4" />PDF</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          {!payments.length ? <Empty label="No payments yet" /> : (
            <div className="space-y-2">
              {payments.map((p: any, idx: number) => (
                <Card key={p.id} className={`p-4 rounded-xl border flex justify-between items-center gap-3 ${p.invoice_id ? "cursor-pointer hover:shadow-card transition-shadow" : ""}`}
                  onClick={() => p.invoice_id && setOpenInvId(p.invoice_id)}>
                  <div>
                    <div className="font-semibold">{inr(p.amount)}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(p.payment_date)} · {p.method}</div>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {p.invoice_id && (
                      <Button size="sm" variant="ghost" className="rounded-xl gap-1" onClick={() => setOpenInvId(p.invoice_id)}>
                        <Pencil className="h-4 w-4" />Edit
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={async () => {
                      if (!user) return;
                      const { data: s } = await supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle();
                      let invMeta: any = {};
                      if (p.invoice_id) {
                        const { data: inv } = await supabase.from("invoices").select("invoice_number, total, paid_amount").eq("id", p.invoice_id).maybeSingle();
                        if (inv) invMeta = { invoice_number: inv.invoice_number, invoice_total: Number(inv.total), invoice_paid_total: Number(inv.paid_amount) };
                      }
                      await downloadReceiptPdf({
                        receipt_number: `RCPT-${(payments.length - idx).toString().padStart(4, "0")}`,
                        payment_date: p.payment_date, amount: Number(p.amount), method: p.method, notes: p.notes,
                        ...invMeta,
                      }, s || {}, client);
                    }}><Download className="h-4 w-4" />Receipt</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Textarea rows={2} placeholder="Add a note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} />
            <Button onClick={addNote} className="rounded-xl">Add</Button>
          </div>
          {!notes.length ? <Empty label="No notes yet" /> : (
            <div className="space-y-2">
              {notes.map((n: any) => (
                <Card key={n.id} className="p-4 rounded-xl border">
                  <div className="text-xs text-muted-foreground mb-1">{fmtDate(n.created_at)}</div>
                  <div className="text-sm whitespace-pre-wrap">{n.content}</div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <InvoiceDetailDialog invoiceId={openInvId} open={!!openInvId} onOpenChange={(o) => !o && setOpenInvId(null)} />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <Card className="p-8 rounded-2xl border text-center text-muted-foreground">{label}</Card>;
}

function ClientTaskList({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: tasks = [] } = useQuery({
    queryKey: ["client-tasks", clientId],
    queryFn: async () => (await supabase.from("tasks").select("*").eq("client_id", clientId).order("due_date")).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ title: "", description: "", due_date: "", priority: "medium", status: "pending" });

  const save = async () => {
    if (!user || !f.title) return;
    await supabase.from("tasks").insert({ ...f, user_id: user.id, client_id: clientId, due_date: f.due_date || null });
    setOpen(false);
    setF({ title: "", description: "", due_date: "", priority: "medium", status: "pending" });
    qc.invalidateQueries({ queryKey: ["client-tasks", clientId] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const toggle = async (t: any) => {
    const next = t.status === "completed" ? "pending" : "completed";
    await supabase.from("tasks").update({ status: next }).eq("id", t.id);
    qc.invalidateQueries({ queryKey: ["client-tasks", clientId] });
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button className="rounded-xl gap-2"><Plus className="h-4 w-4" />Add task</Button></DialogTrigger>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
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
      {!tasks.length ? <Empty label="No tasks yet" /> : tasks.map((t: any) => (
        <Card key={t.id} className="p-4 rounded-xl border flex items-center gap-3">
          <input type="checkbox" checked={t.status === "completed"} onChange={() => toggle(t)} className="h-5 w-5 accent-primary" />
          <div className="flex-1 min-w-0">
            <div className={t.status === "completed" ? "line-through text-muted-foreground" : "font-medium"}>{t.title}</div>
            <div className="text-xs text-muted-foreground">{fmtDate(t.due_date)} · {t.priority}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ClientLedger({ clientId, entries }: { clientId: string; entries: any[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const remove = async (id: string) => {
    if (!confirm("Delete this work entry?")) return;
    const { error } = await supabase.from("ledger_entries").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["client-ledger", clientId] });
    qc.invalidateQueries({ queryKey: ["ledger"] });
  };

  const generateInvoice = async (e: any) => {
    if (!user) return;
    try {
      const num = await nextInvoiceNumber(user.id);
      const amt = Number(e.amount);
      const { data: inv, error } = await supabase.from("invoices").insert({
        user_id: user.id, client_id: clientId, invoice_number: num,
        invoice_date: e.entry_date,
        items: [{ description: e.service_name, qty: 1, rate: amt }] as any,
        subtotal: amt, gst_amount: 0, discount: 0, total: amt,
        paid_amount: e.payment_status === "paid" ? amt : 0,
        status: e.payment_status === "paid" ? "paid" : "unpaid",
        notes: e.notes,
      }).select().maybeSingle();
      if (error) throw error;
      await supabase.from("ledger_entries").update({ invoice_id: inv?.id, invoice_status: "draft" }).eq("id", e.id);
      toast.success(`Invoice ${num} created`);
      qc.invalidateQueries({ queryKey: ["client-ledger", clientId] });
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-3">
      <Button className="rounded-xl gap-2" onClick={() => { setEditing(null); setOpen(true); }}>
        <Plus className="h-4 w-4" /> Add work entry
      </Button>
      {!entries.length ? <Empty label="No work entries yet" /> : (
        <div className="space-y-2">
          {entries.map((e: any) => (
            <Card key={e.id} className="p-4 rounded-xl border">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{e.service_name}</span>
                    <Badge variant={e.payment_status === "paid" ? "secondary" : "destructive"} className="rounded-full text-[10px] capitalize">{e.payment_status}</Badge>
                    {e.invoice_status !== "none" && <Badge variant="outline" className="rounded-full text-[10px] capitalize">Inv: {e.invoice_status}</Badge>}
                    {Array.isArray(e.addons) && e.addons.length > 0 && <Badge variant="outline" className="rounded-full text-[10px]">+{e.addons.length} add-on{e.addons.length > 1 ? "s" : ""}</Badge>}
                  </div>
                  {Array.isArray(e.addons) && e.addons.length > 0 && (
                    <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {e.addons.map((a: any, i: number) => (
                        <li key={i} className="flex justify-between gap-3">
                          <span className="truncate">+ {a.description || "Add-on"}</span>
                          <span>{inr(a.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">{fmtDate(e.entry_date)}</div>
                  {e.notes && <div className="text-xs text-muted-foreground mt-1">{e.notes}</div>}
                </div>
                <div className="text-right shrink-0"><div className="font-semibold">{inr(e.amount)}</div></div>
                <div className="flex gap-1 w-full sm:w-auto justify-end">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }} title="Edit"><Pencil className="h-4 w-4" /></Button>
                  {!e.invoice_id && <Button size="icon" variant="ghost" onClick={() => generateInvoice(e)} title="Generate invoice"><FileText className="h-4 w-4" /></Button>}
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(e.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <LedgerEntryDialog open={open} onOpenChange={setOpen} initial={editing} clientId={clientId} />
    </div>
  );
}

