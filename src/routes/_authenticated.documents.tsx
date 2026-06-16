import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";
import { Upload, Download, FileIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "Documents — DO Business Manager" }] }),
  component: DocsPage,
});

function DocsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: docs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => (await supabase.from("documents").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error } = await supabase.from("documents").insert({
      user_id: user.id, name: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Uploaded");
    qc.invalidateQueries({ queryKey: ["documents"] });
  };

  const download = async (d: any) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(d.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div>
      <PageHeader title="Documents" action={
        <Button asChild className="rounded-xl gap-2" disabled={uploading}>
          <label><Upload className="h-4 w-4" />{uploading ? "Uploading..." : "Upload"}
            <input type="file" className="hidden" onChange={onFile} />
          </label>
        </Button>
      } />
      {!docs.length ? <Card className="p-12 rounded-2xl border text-center text-muted-foreground">No documents yet.</Card> : (
        <div className="grid sm:grid-cols-2 gap-3">
          {docs.map((d: any) => (
            <Card key={d.id} className="p-4 rounded-xl border flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent"><FileIcon className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{d.name}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(d.created_at)}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => download(d)}><Download className="h-4 w-4" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
