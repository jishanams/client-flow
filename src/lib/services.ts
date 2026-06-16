export const SERVICE_TEMPLATES = [
  "Logo Design",
  "Website",
  "Poster Design",
  "Reel Editing",
  "Animation",
  "Social Media Retainer",
  "Branding",
  "Video Editing",
  "Photography",
  "Custom Service",
] as const;

export type PaymentStatus = "pending" | "paid" | "partial";
export type InvoiceStatus = "none" | "draft" | "sent" | "paid";
