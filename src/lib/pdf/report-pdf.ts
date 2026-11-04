import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { SiteSettings } from "@/config/defaults";
import { SEVERITY_LABELS, STATUS_LABELS, type ReportViewModel } from "@/lib/reports/view-model";
import type { Severity } from "@/lib/scanner/types";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const NAVY = rgb(0.04, 0.07, 0.13);
const TEXT = rgb(0.12, 0.15, 0.22);
const MUTED = rgb(0.38, 0.43, 0.52);
const LINE = rgb(0.86, 0.88, 0.92);

const SEV_COLORS: Record<Severity, RGB> = {
  critical: rgb(0.94, 0.31, 0.43),
  high: rgb(0.95, 0.51, 0.29),
  medium: rgb(0.85, 0.65, 0.12),
  low: rgb(0.29, 0.64, 0.95),
  informational: rgb(0.55, 0.6, 0.7),
};

/** Standard PDF fonts are WinAnsi-encoded; replace anything they cannot render. */
export function pdfSafe(input: string | null | undefined): string {
  return (input ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•·]/g, "-")
    .replace(/`/g, "")
    .replace(/[^\x20-\x7E\n -ÿ]/g, "?");
}

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return rgb(0.12, 0.72, 0.84);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

class Writer {
  page!: PDFPage;
  y = 0;
  pageNo = 0;
  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
    private brand: RGB,
    private footer: string,
  ) {}

  newPage() {
    this.page = this.doc.addPage(A4);
    this.pageNo++;
    this.y = A4[1] - MARGIN;
    this.page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: this.brand });
    this.page.drawText(pdfSafe(this.footer), { x: MARGIN, y: 28, size: 8, font: this.font, color: MUTED });
    this.page.drawText(`Page ${this.pageNo}`, { x: A4[0] - MARGIN - 40, y: 28, size: 8, font: this.font, color: MUTED });
  }

  ensure(space: number) {
    if (this.y - space < 60) this.newPage();
  }

  wrap(text: string, size: number, font: PDFFont, width: number): string[] {
    const lines: string[] = [];
    for (const para of pdfSafe(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
        else {
          if (line) lines.push(line);
          // Hard-break very long tokens (e.g. URLs)
          let w = word;
          while (font.widthOfTextAtSize(w, size) > width && w.length > 1) {
            let cut = w.length;
            while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > width) cut--;
            lines.push(w.slice(0, cut));
            w = w.slice(cut);
          }
          line = w;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  text(text: string, opts: { size?: number; bold?: boolean; color?: RGB; indent?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    const x = MARGIN + (opts.indent ?? 0);
    const lines = this.wrap(text, size, font, A4[0] - MARGIN - x);
    for (const l of lines) {
      this.ensure(size + 4);
      this.page.drawText(l, { x, y: this.y - size, size, font, color: opts.color ?? TEXT });
      this.y -= size + 4;
    }
    this.y -= opts.gap ?? 4;
  }

  heading(text: string) {
    this.ensure(40);
    this.text(text, { size: 16, bold: true, color: NAVY, gap: 2 });
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4[0] - MARGIN, y: this.y }, thickness: 1, color: LINE });
    this.y -= 12;
  }

  pill(label: string, color: RGB) {
    const size = 8;
    const w = this.bold.widthOfTextAtSize(label, size) + 12;
    this.ensure(18);
    this.page.drawRectangle({ x: MARGIN, y: this.y - 14, width: w, height: 14, color });
    this.page.drawText(label, { x: MARGIN + 6, y: this.y - 10.5, size, font: this.bold, color: rgb(1, 1, 1) });
    this.y -= 20;
  }

  kv(rows: [string, string][]) {
    for (const [k, v] of rows) {
      this.ensure(16);
      this.page.drawText(pdfSafe(k), { x: MARGIN, y: this.y - 10, size: 10, font: this.font, color: MUTED });
      const lines = this.wrap(v, 10, this.bold, A4[0] - MARGIN * 2 - 170);
      lines.forEach((l, i) => this.page.drawText(l, { x: MARGIN + 170, y: this.y - 10 - i * 14, size: 10, font: this.bold, color: TEXT }));
      this.y -= Math.max(1, lines.length) * 14 + 2;
    }
    this.y -= 6;
  }
}

export interface PdfContact {
  website: string | null;
  email: string | null;
  whatsapp: string | null;
  consultationUrl: string;
}

export async function generateReportPdf(vm: ReportViewModel, settings: SiteSettings, contact: PdfContact): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`${settings.businessName} Security Health Report - ${vm.domain}`));
  doc.setAuthor(pdfSafe(settings.businessName));
  doc.setSubject("Preliminary automated website security configuration assessment");
  doc.setCreator(pdfSafe(`${settings.businessName} Security Health`));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = hexToRgb(settings.reportBrandColor);
  const w = new Writer(doc, font, bold, brand, `${settings.businessName} Security Health - Report ${vm.reportNumber} - Confidential`);

  // PAGE 1 — Executive summary
  w.newPage();
  w.page.drawRectangle({ x: 0, y: A4[1] - 220, width: A4[0], height: 214, color: NAVY });
  w.page.drawText(pdfSafe(settings.businessName.toUpperCase()), { x: MARGIN, y: A4[1] - 60, size: 12, font: bold, color: brand });
  w.page.drawText("Website Security Health Report", { x: MARGIN, y: A4[1] - 95, size: 24, font: bold, color: rgb(1, 1, 1) });
  w.page.drawText(pdfSafe(vm.websiteName ? `${vm.websiteName} (${vm.domain})` : vm.domain), { x: MARGIN, y: A4[1] - 122, size: 13, font, color: rgb(0.85, 0.9, 0.97) });
  w.page.drawText(pdfSafe(`Report ${vm.reportNumber}`), { x: MARGIN, y: A4[1] - 145, size: 10, font, color: rgb(0.7, 0.76, 0.86) });
  const scoreText = vm.score === null ? "N/A" : String(vm.score);
  w.page.drawText(scoreText, { x: A4[0] - MARGIN - bold.widthOfTextAtSize(scoreText, 48), y: A4[1] - 110, size: 48, font: bold, color: rgb(1, 1, 1) });
  w.page.drawText("/ 100 configuration score", { x: A4[0] - MARGIN - 120, y: A4[1] - 130, size: 9, font, color: rgb(0.7, 0.76, 0.86) });
  w.y = A4[1] - 250;
  w.heading("Executive summary");
  w.kv([
    ["Target domain", vm.domain],
    ["Website name", vm.websiteName ?? "-"],
    ["Organisation", vm.companyName],
    ["Assessment date (UTC)", vm.assessmentDate ? new Date(vm.assessmentDate).toUTCString() : "-"],
    ["Configuration score", vm.score === null ? "Not calculated" : `${vm.score}/100 - ${vm.bandLabel}`],
  ]);
  w.text(vm.summaryText, { size: 11, gap: 10 });
  w.text(vm.disclaimer, { size: 9, color: MUTED });

  // PAGE 2 — Security check results
  w.newPage();
  w.heading("Security check results");
  w.kv([
    ["Checks performed", String(vm.counts.performed)],
    ["Checks passed", String(vm.counts.passed)],
    ["Checks needing attention", String(vm.counts.attention)],
    ["Checks unavailable", String(vm.counts.unavailable)],
    ["Findings", (Object.keys(vm.findingsBySeverity) as Severity[]).map((s) => `${SEVERITY_LABELS[s]}: ${vm.findingsBySeverity[s]}`).join("   ")],
  ]);
  for (const group of vm.checksByCategory) {
    w.text(group.label, { size: 12, bold: true, color: NAVY, gap: 2 });
    for (const c of group.checks) w.text(`${STATUS_LABELS[c.status]} - ${c.title}: ${c.summary}`, { size: 9, indent: 10, gap: 1 });
    w.y -= 6;
  }

  // PAGE 3 — Detailed findings
  w.newPage();
  w.heading("Detailed findings");
  if (!vm.findings.length) w.text("No findings were raised by the automated checks performed.", { size: 11 });
  for (const f of vm.findings) {
    w.ensure(120);
    w.pill(SEVERITY_LABELS[f.severity].toUpperCase(), SEV_COLORS[f.severity]);
    w.text(f.title, { size: 12, bold: true, color: NAVY, gap: 2 });
    w.text(`Observation: ${f.observation}`, { size: 9.5 });
    w.text(`Why it matters: ${f.explanation}`, { size: 9.5 });
    w.text(`Potential business impact: ${f.impact}`, { size: 9.5 });
    const evidence = Object.entries(f.evidence ?? {})
      .filter(([k, v]) => v !== undefined && v !== null && v !== "" && k !== "purpose")
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("; ")
      .slice(0, 600);
    if (evidence) w.text(`Evidence: ${evidence}`, { size: 8.5, color: MUTED });
    w.text(`Recommended improvement: ${f.remediation}`, { size: 9.5 });
    w.text(`Confidence: ${f.confidence}. Limitation: ${f.limitation}`, { size: 8.5, color: MUTED, gap: 12 });
  }

  // PAGE 4 — Remediation recommendations
  w.newPage();
  w.heading("Remediation recommendations");
  w.text("Based on confirmed observations", { size: 12, bold: true, color: NAVY });
  if (!vm.findings.length) w.text("No specific remediation items arose from the automated checks.", { size: 10 });
  const seen = new Set<string>();
  for (const f of vm.findings) {
    if (seen.has(f.title)) continue;
    seen.add(f.title);
    w.text(`- [${SEVERITY_LABELS[f.severity]}] ${f.title}: ${f.remediation}`, { size: 9.5, indent: 6 });
  }
  w.y -= 8;
  w.text("General good practice (not based on findings from this assessment)", { size: 12, bold: true, color: NAVY });
  for (const r of vm.generalRecommendations) w.text(`- ${r}`, { size: 9.5, indent: 6 });
  if (vm.technologies.length) {
    w.y -= 8;
    w.text("Technology indicators observed", { size: 12, bold: true, color: NAVY });
    for (const t of vm.technologies) w.text(`- ${t.name} (${t.confidence} confidence): ${t.evidence}`, { size: 9, indent: 6 });
    w.text("Technology indicators are passive observations and do not confirm how the website was built.", { size: 8.5, color: MUTED });
  }
  w.y -= 8;
  w.text("Assessment limitations", { size: 12, bold: true, color: NAVY });
  for (const l of vm.limitations) w.text(`- ${l}`, { size: 9, indent: 6, color: MUTED });

  // PAGE 5 — Professional next steps
  w.newPage();
  w.heading("Professional next steps");
  w.text("Your website has been assessed using our preliminary automated security checks.", { size: 11 });
  w.text("Some security concerns may require deeper investigation and manual verification.", { size: 11 });
  w.text(`${settings.businessName} can help you review your application, investigate identified issues and implement appropriate security improvements.`, { size: 11 });
  w.text("Contact our team to discuss a professional assessment and remediation plan.", { size: 11, gap: 14 });
  const rows: [string, string][] = [];
  if (contact.website) rows.push(["Website", contact.website]);
  if (contact.email) rows.push(["Email", contact.email]);
  if (contact.whatsapp) rows.push(["WhatsApp", contact.whatsapp]);
  rows.push(["Request a consultation", contact.consultationUrl]);
  w.kv(rows);
  w.y -= 10;
  w.text(settings.assessmentDisclaimer, { size: 8.5, color: MUTED });

  return doc.save();
}
