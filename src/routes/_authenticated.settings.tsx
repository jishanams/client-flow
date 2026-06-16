import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — DO Business Manager" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState<any>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle()).data,
  });

  useEffect(() => { if (data) setF(data); }, [data]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("company_settings").upsert({ ...f, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const uploadLogo = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
      const next = { ...f, logo_url: pub.publicUrl };
      setF(next);
      await supabase.from("company_settings").upsert({ ...next, user_id: user.id });
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Logo uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!user) return;
    const next = { ...f, logo_url: null };
    setF(next);
    await supabase.from("company_settings").upsert({ ...next, user_id: user.id });
    qc.invalidateQueries({ queryKey: ["settings"] });
    toast.success("Logo removed");
  };

  const field = (key: string, label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={f[key] ?? ""} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </div>
  );

  return (
    <div>
      <PageHeader title="Settings" description="Your company information and preferences" />
      <Card className="p-5 lg:p-6 rounded-2xl border space-y-5">
        <div>
          <h2 className="font-semibold mb-3">Company logo</h2>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-xl border bg-muted/30 grid place-items-center overflow-hidden">
              {f.logo_url ? <img src={f.logo_url} alt="Logo" className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">No logo</span>}
            </div>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload className="h-4 w-4" />{uploading ? "Uploading..." : f.logo_url ? "Replace" : "Upload"}
              </Button>
              {f.logo_url && <Button variant="ghost" className="rounded-xl text-destructive gap-2" onClick={removeLogo}><Trash2 className="h-4 w-4" />Remove</Button>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Appears on invoice and quotation PDFs.</p>
        </div>
        <div>
          <h2 className="font-semibold mb-3">Company</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {field("company_name", "Company name")}
            {field("email", "Email", "email")}
            {field("phone", "Phone")}
            {field("website", "Website")}
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Textarea rows={2} value={f.address ?? ""} onChange={(e) => setF({ ...f, address: e.target.value })} />
            </div>
          </div>
        </div>
        <div>
          <h2 className="font-semibold mb-3">Tax & Bank</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {field("gst_number", "GST number")}
            {field("pan_number", "PAN number")}
            {field("bank_name", "Bank name")}
            {field("bank_account", "Account number")}
            {field("bank_ifsc", "IFSC")}
            {field("upi_id", "UPI ID")}
          </div>
        </div>
        <div>
          <h2 className="font-semibold mb-3">Numbering</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {field("invoice_prefix", "Invoice prefix")}
            {field("quotation_prefix", "Quotation prefix")}
          </div>
        </div>
        <Button onClick={save} className="rounded-xl">Save changes</Button>
      </Card>
    </div>
  );
}
