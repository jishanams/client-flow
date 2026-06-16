import { supabase } from "@/integrations/supabase/client";

export async function nextInvoiceNumber(userId: string): Promise<string> {
  const { data: settings } = await supabase
    .from("company_settings")
    .select("invoice_prefix")
    .eq("user_id", userId)
    .maybeSingle();
  const prefix = settings?.invoice_prefix || "INV";
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  const n = String((count ?? 0) + 1).padStart(4, "0");
  return `${prefix}-${year}-${n}`;
}

export async function nextQuotationNumber(userId: string): Promise<string> {
  const { data: settings } = await supabase
    .from("company_settings")
    .select("quotation_prefix")
    .eq("user_id", userId)
    .maybeSingle();
  const prefix = settings?.quotation_prefix || "QT";
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("quotations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  const n = String((count ?? 0) + 1).padStart(4, "0");
  return `${prefix}-${year}-${n}`;
}
