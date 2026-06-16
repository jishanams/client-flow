import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientPicker } from "@/components/ClientPicker";
import { downloadLetterPdf } from "@/lib/pdf";
import { Plus, Trash2, Pencil, FileText, Download, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/letters")({
  head: () => ({ meta: [{ title: "Letters & Templates — DO Business Manager" }] }),
  component: LettersPage,
});

const DEFAULTS = [
  {
    kind: "offer", title: "Offer Letter",
    body: `Dear {{client_name}},

We are pleased to extend an offer for the position / engagement described below.

Role / Scope: __________
Start date: __________
Compensation: ₹__________

Your engagement will be governed by the standard terms shared separately. Please countersign and return a copy of this letter to confirm acceptance.

We look forward to working with you.

Sincerely,
{{company_name}}`,
  },
  {
    kind: "termination", title: "Termination Letter",
    body: `Dear {{client_name}},

This letter serves as formal notice of termination of the agreement between {{client_name}} and {{company_name}}, effective __________.

Reason: __________

All outstanding deliverables and dues shall be settled within __________ days of this notice. Both parties shall return any confidential materials in their possession.

We thank you for the engagement and wish you continued success.

Sincerely,
{{company_name}}`,
  },
  {
    kind: "nda", title: "Non-Disclosure Agreement",
    body: `This Non-Disclosure Agreement ("Agreement") is entered into on __________ by and between {{company_name}} ("Disclosing Party") and {{client_name}} ("Receiving Party").

1. Confidential Information. All non-public information shared by the Disclosing Party shall be treated as confidential.

2. Obligations. The Receiving Party shall not disclose, reproduce, or use the Confidential Information except for the purposes contemplated herein.

3. Term. This Agreement shall remain in force for a period of __________ years from the date above.

4. Return of Materials. Upon request, the Receiving Party shall return or destroy all Confidential Information.

5. Governing Law. This Agreement is governed by the laws of __________.

Signed,

{{company_name}}                              {{client_name}}`,
  },
  {
    kind: "agreement", title: "Service Agreement",
    body: `This Service Agreement is entered into on __________ between {{company_name}} ("Service Provider") and {{client_name}} ("Client").

1. Scope of Work. The Service Provider shall deliver: __________.

2. Fees. The Client agrees to pay ₹__________ as per the agreed schedule.

3. Term. This Agreement shall commence on __________ and continue until __________ unless terminated earlier.

4. Confidentiality. Each party shall keep confidential all non-public information exchanged.

5. Termination. Either party may terminate this Agreement with __________ days written notice.

6. Governing Law. This Agreement shall be governed by the laws of __________.

Signed,

{{company_name}}                              {{client_name}}`,
  },
];

function LettersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [f, setF] = useState({ kind: "custom", title: "", body: "" });
  const [genFor, setGenFor] = useState<any | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["letter-templates"],
    queryFn: async () =>
      (await supabase.from("letter_templates").select("*").is("deleted_at", null).order("created_at")).data ?? [],
  });

  // Seed defaults on first load
  useEffect(() => {
    if (!user || isLoading || templates.length) return;
    (async () => {
      await supabase.from("letter_templates").insert(
        DEFAULTS.map((d) => ({ ...d, user_id: user.id })),
      );
      qc.invalidateQueries({ queryKey: ["letter-templates"] });
    })();
  }, [user, isLoading, templates.length, qc]);

  const openAdd = () => { setEditing(null); setF({ kind: "custom", title: "", body: "" }); setOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setF({ kind: t.kind, title: t.title, body: t.body }); setOpen(true); };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !f.title) return toast.error("Title required");
    const { error } = editing
      ? await supabase.from("letter_templates").update({ ...f }).eq("id", editing.id)
      : await supabase.from("letter_templates").insert({ ...f, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success(editing ? "Template saved" : "Template created");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["letter-templates"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Move to Trash?")) return;
    const { error } = await supabase.from("letter_templates").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Moved to Trash");
    qc.invalidateQueries({ queryKey: ["letter-templates"] });
    qc.invalidateQueries({ queryKey: ["trash", "letter_templates"] });
  };

  return (
    <div>
      <PageHeader
        title="Letters & Templates"
        description="Offer letter, termination, NDA, agreement. Edit, duplicate, generate for any client."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="rounded-xl gap-2" onClick={openAdd}><Plus className="h-4 w-4" />New template</Button></DialogTrigger>
            <DialogContent className="rounded-2xl max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5 col-span-2"><Label>Title *</Label><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Kind</Label>
                    <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="offer">Offer letter</SelectItem>
                        <SelectItem value="termination">Termination</SelectItem>
                        <SelectItem value="nda">NDA</SelectItem>
                        <SelectItem value="agreement">Agreement</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Body — use <code className="text-xs">{`{{client_name}}`}</code> and <code className="text-xs">{`{{company_name}}`}</code> as placeholders</Label>
                  <Textarea rows={18} className="font-mono text-sm" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
                </div>
                <Button type="submit" className="w-full gap-1"><Save className="h-4 w-4" />{editing ? "Save changes" : "Create template"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {!templates.length ? (
        <Card className="p-12 rounded-2xl border text-center text-muted-foreground">Setting up your templates…</Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {templates.map((t: any) => (
            <Card key={t.id} className="p-4 rounded-2xl border flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent shrink-0"><FileText className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{t.title}</div>
                  <Badge variant="outline" className="rounded-full text-[10px] capitalize mt-1">{t.kind}</Badge>
                </div>
              </div>
              <div className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-line">{t.body}</div>
              <div className="flex gap-2 mt-auto">
                <Button size="sm" variant="outline" className="rounded-xl gap-1 flex-1" onClick={() => setGenFor(t)}>
                  <Download className="h-3.5 w-3.5" />Generate
                </Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <GenerateDialog template={genFor} onClose={() => setGenFor(null)} />
    </div>
  );
}

function GenerateDialog({ template, onClose }: { template: any | null; onClose: () => void }) {
  const { user } = useAuth();
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    enabled: !!clientId,
    queryFn: async () => (await supabase.from("clients").select("*").eq("id", clientId).maybeSingle()).data,
  });
  const { data: settings } = useQuery({
    queryKey: ["company-settings", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle()).data ?? {},
  });

  useEffect(() => {
    if (!template) return;
    setTitle(template.title);
    setClientId("");
    setBody(template.body);
  }, [template]);

  useEffect(() => {
    if (!template) return;
    const cn = client?.name || "________";
    const co = (settings as any)?.company_name || "________";
    setBody(
      template.body
        .replaceAll("{{client_name}}", cn)
        .replaceAll("{{company_name}}", co),
    );
  }, [client, settings, template]);

  const download = async () => {
    await downloadLetterPdf({ title, body }, (settings as any) || {});
    toast.success("Letter downloaded");
  };

  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Generate · {template?.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Client (optional)</Label>
              <ClientPicker value={clientId} onChange={setClientId} placeholder="Pick a client to auto-fill" />
            </div>
            <div className="space-y-1.5"><Label>Document title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Letter body (editable)</Label>
            <Textarea rows={18} className="font-mono text-sm" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <Button onClick={download} className="w-full gap-1"><Download className="h-4 w-4" />Download PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
