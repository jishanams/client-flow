import jsPDF from "jspdf";
import { inrFull, fmtDate } from "./format";

type Doc = {
  kind: "invoice" | "quotation";
  number: string;
  date: string;
  due_date?: string | null;
  items: { description: string; qty: number; rate: number }[];
  subtotal: number;
  discount: number;
  gst_amount: number;
  total: number;
  paid_amount?: number;
  notes?: string | null;
};

type Company = {
  company_name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_ifsc?: string | null;
  upi_id?: string | null;
  logo_url?: string | null;
};

type Client = {
  name: string;
  company_name?: string | null;
  address?: string | null;
  gst_number?: string | null;
  email?: string | null;
  phone?: string | null;
};

async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const data: string = await new Promise((r) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result as string);
      fr.readAsDataURL(blob);
    });
    const img = await new Promise<HTMLImageElement>((res2, rej) => {
      const i = new Image();
      i.onload = () => res2(i);
      i.onerror = rej;
      i.src = data;
    });
    return { data, w: img.width, h: img.height };
  } catch {
    return null;
  }
}

export async function downloadDocPdf(doc: Doc, company: Company, client: Client) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 40;

  // Brand colors
  const ACCENT: [number, number, number] = [17, 24, 39]; // slate-900
  const ACCENT_SOFT: [number, number, number] = [243, 244, 246]; // gray-100
  const MUTED: [number, number, number] = [107, 114, 128]; // gray-500
  const TEXT: [number, number, number] = [17, 24, 39];
  const LINE: [number, number, number] = [229, 231, 235];

  // ===== HEADER BAND =====
  pdf.setFillColor(...ACCENT).rect(0, 0, W, 110, "F");

  // Logo (left)
  let logoBottom = 30;
  if (company.logo_url) {
    const img = await loadImage(company.logo_url);
    if (img) {
      const h = 46;
      const w = Math.min((img.w / img.h) * h, 130);
      try {
        pdf.addImage(img.data, "PNG", M, 32, w, h);
        logoBottom = 32 + h;
      } catch {
        // ignore unsupported image type
      }
    }
  }

  // Document title (right)
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold").setFontSize(28);
  pdf.text(doc.kind === "invoice" ? "INVOICE" : "QUOTATION", W - M, 56, { align: "right" });
  pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(200, 200, 210);
  pdf.text(`#${doc.number}`, W - M, 74, { align: "right" });
  pdf.text(fmtDate(doc.date), W - M, 90, { align: "right" });

  let y = 140;

  // ===== FROM / BILL TO =====
  const colW = (W - 2 * M - 20) / 2;

  // From
  pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED);
  pdf.text("FROM", M, y);
  pdf.setFont("helvetica", "bold").setFontSize(12).setTextColor(...TEXT);
  pdf.text(company.company_name || "Your Company", M, y + 16);
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  const fromLines = [
    company.address,
    company.phone,
    company.email,
    company.gst_number ? `GSTIN: ${company.gst_number}` : null,
  ].filter(Boolean) as string[];
  fromLines.forEach((l, i) => {
    const wrapped = pdf.splitTextToSize(l, colW);
    pdf.text(wrapped, M, y + 30 + i * 12);
  });

  // Bill To
  const bx = M + colW + 20;
  pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED);
  pdf.text("BILL TO", bx, y);
  pdf.setFont("helvetica", "bold").setFontSize(12).setTextColor(...TEXT);
  pdf.text(client.name, bx, y + 16);
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  const toLines = [
    client.company_name,
    client.address,
    client.phone,
    client.email,
    client.gst_number ? `GSTIN: ${client.gst_number}` : null,
  ].filter(Boolean) as string[];
  toLines.forEach((l, i) => {
    const wrapped = pdf.splitTextToSize(l, colW);
    pdf.text(wrapped, bx, y + 30 + i * 12);
  });

  y += 30 + Math.max(fromLines.length, toLines.length) * 12 + 30;

  // ===== META PILLS =====
  pdf.setFillColor(...ACCENT_SOFT).roundedRect(M, y, W - 2 * M, 36, 6, 6, "F");
  pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED);
  pdf.text("ISSUE DATE", M + 14, y + 14);
  if (doc.due_date) pdf.text("DUE DATE", M + 160, y + 14);
  pdf.text(doc.kind === "invoice" ? "AMOUNT DUE" : "TOTAL", W - M - 14, y + 14, { align: "right" });

  pdf.setFont("helvetica", "bold").setFontSize(11).setTextColor(...TEXT);
  pdf.text(fmtDate(doc.date), M + 14, y + 28);
  if (doc.due_date) pdf.text(fmtDate(doc.due_date), M + 160, y + 28);
  const dueAmt = doc.kind === "invoice" ? doc.total - (doc.paid_amount ?? 0) : doc.total;
  pdf.text(inrFull(dueAmt), W - M - 14, y + 28, { align: "right" });

  y += 60;

  // ===== ITEMS TABLE =====
  // Header
  pdf.setFillColor(...ACCENT).rect(M, y, W - 2 * M, 28, "F");
  pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(255, 255, 255);
  pdf.text("DESCRIPTION", M + 14, y + 18);
  pdf.text("QTY", W - M - 220, y + 18, { align: "right" });
  pdf.text("RATE", W - M - 110, y + 18, { align: "right" });
  pdf.text("AMOUNT", W - M - 14, y + 18, { align: "right" });
  y += 28;

  // Rows
  pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(...TEXT);
  doc.items.forEach((it, idx) => {
    const amt = Number(it.qty) * Number(it.rate);
    const desc = pdf.splitTextToSize(String(it.description || "—"), W - 2 * M - 260);
    const rowH = Math.max(28, desc.length * 14 + 14);
    if (idx % 2 === 1) {
      pdf.setFillColor(250, 250, 251).rect(M, y, W - 2 * M, rowH, "F");
    }
    pdf.setTextColor(...TEXT).setFont("helvetica", "normal").setFontSize(10);
    pdf.text(desc, M + 14, y + 18);
    pdf.text(String(it.qty), W - M - 220, y + 18, { align: "right" });
    pdf.text(inrFull(it.rate), W - M - 110, y + 18, { align: "right" });
    pdf.text(inrFull(amt), W - M - 14, y + 18, { align: "right" });
    y += rowH;
  });

  pdf.setDrawColor(...LINE).setLineWidth(0.5).line(M, y, W - M, y);
  y += 20;

  // ===== TOTALS BOX (right) =====
  const boxW = 220;
  const bxLeft = W - M - boxW;
  const row = (label: string, val: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal").setFontSize(bold ? 12 : 10);
    pdf.setTextColor(...(bold ? TEXT : MUTED));
    pdf.text(label, bxLeft + 14, y);
    pdf.setTextColor(...TEXT);
    pdf.text(val, W - M - 14, y, { align: "right" });
    y += bold ? 20 : 16;
  };
  row("Subtotal", inrFull(doc.subtotal));
  if (doc.discount) row("Discount", `- ${inrFull(doc.discount)}`);
  if (doc.gst_amount) row("GST", inrFull(doc.gst_amount));

  // Total accent
  pdf.setFillColor(...ACCENT).roundedRect(bxLeft, y - 6, boxW, 30, 4, 4, "F");
  pdf.setFont("helvetica", "bold").setFontSize(11).setTextColor(220, 220, 230);
  pdf.text("TOTAL", bxLeft + 14, y + 12);
  pdf.setFontSize(14).setTextColor(255, 255, 255);
  pdf.text(inrFull(doc.total), W - M - 14, y + 13, { align: "right" });
  y += 36;

  if (doc.kind === "invoice" && (doc.paid_amount ?? 0) > 0) {
    row("Paid", inrFull(doc.paid_amount ?? 0));
    row("Balance Due", inrFull(doc.total - (doc.paid_amount ?? 0)), true);
  }

  y += 16;

  // ===== PAYMENT DETAILS =====
  if (doc.kind === "invoice" && (company.bank_account || company.upi_id)) {
    pdf.setFillColor(...ACCENT_SOFT).roundedRect(M, y, W - 2 * M, 90, 6, 6, "F");
    pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...MUTED);
    pdf.text("PAYMENT DETAILS", M + 14, y + 18);
    pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(...TEXT);
    let py = y + 36;
    const half = (W - 2 * M) / 2;
    if (company.bank_name) {
      pdf.setTextColor(...MUTED).text("Bank", M + 14, py);
      pdf.setTextColor(...TEXT).text(company.bank_name, M + 70, py);
    }
    if (company.bank_account) {
      pdf.setTextColor(...MUTED).text("A/C", M + 14, py + 16);
      pdf.setTextColor(...TEXT).text(company.bank_account, M + 70, py + 16);
    }
    if (company.bank_ifsc) {
      pdf.setTextColor(...MUTED).text("IFSC", M + 14, py + 32);
      pdf.setTextColor(...TEXT).text(company.bank_ifsc, M + 70, py + 32);
    }
    if (company.upi_id) {
      pdf.setTextColor(...MUTED).text("UPI", M + 14 + half, py);
      pdf.setTextColor(...TEXT).setFont("helvetica", "bold").text(company.upi_id, M + 70 + half, py);
      pdf.setFont("helvetica", "normal");
    }
    y += 110;
  }

  // ===== NOTES =====
  if (doc.notes) {
    pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...MUTED);
    pdf.text("NOTES", M, y);
    pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(...TEXT);
    const wrapped = pdf.splitTextToSize(doc.notes, W - 2 * M);
    pdf.text(wrapped, M, y + 16);
  }

  // ===== FOOTER =====
  pdf.setDrawColor(...LINE).line(M, H - 50, W - M, H - 50);
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  pdf.text(company.company_name || "Thank you for your business", M, H - 30);
  pdf.text("Thank you for your business.", W - M, H - 30, { align: "right" });

  pdf.save(`${doc.kind === "invoice" ? "Invoice" : "Quotation"}-${doc.number}.pdf`);
}

type Receipt = {
  receipt_number: string;
  payment_date: string;
  amount: number;
  method: string;
  notes?: string | null;
  invoice_number?: string | null;
  invoice_total?: number | null;
  invoice_paid_total?: number | null;
};

export async function downloadReceiptPdf(receipt: Receipt, company: Company, client: Client) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 40;
  const ACCENT: [number, number, number] = [16, 122, 84]; // green-ish
  const ACCENT_SOFT: [number, number, number] = [236, 253, 245];
  const MUTED: [number, number, number] = [107, 114, 128];
  const TEXT: [number, number, number] = [17, 24, 39];
  const LINE: [number, number, number] = [229, 231, 235];

  pdf.setFillColor(...ACCENT).rect(0, 0, W, 110, "F");
  if (company.logo_url) {
    const img = await loadImage(company.logo_url);
    if (img) {
      const h = 46;
      const w = Math.min((img.w / img.h) * h, 130);
      try { pdf.addImage(img.data, "PNG", M, 32, w, h); } catch {}
    }
  }
  pdf.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(28);
  pdf.text("RECEIPT", W - M, 56, { align: "right" });
  pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(220, 240, 230);
  pdf.text(`#${receipt.receipt_number}`, W - M, 74, { align: "right" });
  pdf.text(fmtDate(receipt.payment_date), W - M, 90, { align: "right" });

  let y = 150;

  // Big amount box
  pdf.setFillColor(...ACCENT_SOFT).roundedRect(M, y, W - 2 * M, 90, 8, 8, "F");
  pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...MUTED);
  pdf.text("AMOUNT RECEIVED", M + 20, y + 24);
  pdf.setFont("helvetica", "bold").setFontSize(32).setTextColor(...ACCENT);
  pdf.text(inrFull(receipt.amount), M + 20, y + 64);
  pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(...MUTED);
  pdf.text(`via ${receipt.method.toUpperCase()}`, W - M - 20, y + 64, { align: "right" });
  y += 120;

  // Received from
  pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...MUTED);
  pdf.text("RECEIVED FROM", M, y);
  pdf.setFont("helvetica", "bold").setFontSize(13).setTextColor(...TEXT);
  pdf.text(client.name, M, y + 18);
  pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(...MUTED);
  const lines = [client.company_name, client.phone, client.email].filter(Boolean) as string[];
  lines.forEach((l, i) => pdf.text(l, M, y + 34 + i * 12));
  y += 34 + lines.length * 12 + 24;

  // Details table
  pdf.setDrawColor(...LINE).setLineWidth(0.5).line(M, y, W - M, y); y += 16;
  const rowD = (label: string, val: string) => {
    pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(...MUTED);
    pdf.text(label, M, y);
    pdf.setTextColor(...TEXT).text(val, W - M, y, { align: "right" });
    y += 18;
  };
  rowD("Receipt #", receipt.receipt_number);
  rowD("Date", fmtDate(receipt.payment_date));
  rowD("Method", receipt.method);
  if (receipt.invoice_number) rowD("Against Invoice", receipt.invoice_number);
  if (receipt.invoice_total != null) {
    rowD("Invoice Total", inrFull(receipt.invoice_total));
    const paid = receipt.invoice_paid_total ?? receipt.amount;
    rowD("Total Paid", inrFull(paid));
    const bal = (receipt.invoice_total ?? 0) - paid;
    pdf.setFont("helvetica", "bold").setFontSize(11);
    const balColor: [number, number, number] = bal > 0 ? [220, 38, 38] : ACCENT;
    pdf.setTextColor(...balColor);
    pdf.text("Balance", M, y);
    pdf.text(inrFull(Math.max(0, bal)), W - M, y, { align: "right" });
    y += 22;
  }
  pdf.setDrawColor(...LINE).line(M, y, W - M, y); y += 24;

  if (receipt.notes) {
    pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...MUTED);
    pdf.text("NOTES", M, y);
    pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(...TEXT);
    pdf.text(pdf.splitTextToSize(receipt.notes, W - 2 * M), M, y + 16);
    y += 40;
  }

  // Signature
  pdf.setDrawColor(...LINE).line(W - M - 180, H - 100, W - M, H - 100);
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  pdf.text("Authorized Signature", W - M, H - 86, { align: "right" });
  pdf.text(company.company_name || "", W - M, H - 70, { align: "right" });

  pdf.setDrawColor(...LINE).line(M, H - 50, W - M, H - 50);
  pdf.setTextColor(...MUTED).setFontSize(9);
  pdf.text(company.company_name || "Thank you", M, H - 30);
  pdf.text("Thank you for your payment.", W - M, H - 30, { align: "right" });

  pdf.save(`Receipt-${receipt.receipt_number}.pdf`);
}

export async function downloadLetterPdf(
  letter: { title: string; body: string },
  company: Company,
) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 56;
  const ACCENT: [number, number, number] = [17, 24, 39];
  const MUTED: [number, number, number] = [107, 114, 128];
  const LINE: [number, number, number] = [229, 231, 235];

  let y = M;
  if (company.logo_url) {
    const img = await loadImage(company.logo_url);
    if (img) {
      const h = 40;
      const w = Math.min((img.w / img.h) * h, 120);
      try { pdf.addImage(img.data, "PNG", M, y, w, h); } catch {}
    }
  }
  pdf.setFont("helvetica", "bold").setFontSize(12).setTextColor(...ACCENT);
  pdf.text(company.company_name || "", W - M, y + 14, { align: "right" });
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  const meta = [company.address, company.email, company.phone].filter(Boolean).join(" · ");
  if (meta) pdf.text(pdf.splitTextToSize(meta, 260), W - M, y + 30, { align: "right" });
  y += 64;
  pdf.setDrawColor(...LINE).line(M, y, W - M, y);
  y += 28;

  pdf.setFont("helvetica", "bold").setFontSize(18).setTextColor(...ACCENT);
  pdf.text(letter.title, M, y);
  y += 14;
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  pdf.text(fmtDate(new Date().toISOString()), M, y + 10);
  y += 32;

  pdf.setFont("helvetica", "normal").setFontSize(11).setTextColor(20, 20, 20);
  const paragraphs = letter.body.split(/\n\s*\n/);
  for (const para of paragraphs) {
    const lines = pdf.splitTextToSize(para.replace(/\n/g, " "), W - 2 * M);
    for (const ln of lines) {
      if (y > H - M - 40) { pdf.addPage(); y = M; }
      pdf.text(ln, M, y);
      y += 16;
    }
    y += 8;
  }

  // signature block
  if (y > H - 120) { pdf.addPage(); y = M; }
  y = Math.max(y, H - 140);
  pdf.setDrawColor(...LINE).line(M, y, M + 200, y);
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  pdf.text("Authorized Signature", M, y + 14);
  pdf.text(company.company_name || "", M, y + 28);

  pdf.save(`${letter.title.replace(/[^a-z0-9]+/gi, "-")}.pdf`);
}


