import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ClientDialog } from "./ClientDialog";
import { Plus } from "lucide-react";

export function ClientPicker({
  value, onChange, placeholder = "Select client", className,
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () =>
      (await supabase.from("clients").select("id, name").neq("status", "archived").order("name")).data ?? [],
  });

  return (
    <div className={`flex gap-2 ${className || ""}`}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {clients.map((c: any) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
          {!clients.length && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No clients yet</div>
          )}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        title="Add new client"
        onClick={() => setAddOpen(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>
      <ClientDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={(c) => c?.id && onChange(c.id)}
      />
    </div>
  );
}
