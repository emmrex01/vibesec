const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(businessName: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d172b">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0a1222;padding:20px 28px;color:#ffffff;font-weight:600;font-size:16px">${esc(businessName)} <span style="color:#3fd0e8">Security Health</span></td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">${body}</td></tr>
<tr><td style="padding:16px 28px;background:#f4f6fa;font-size:12px;color:#5a6680">This message relates to a security health check requested for a website you confirmed you own or are authorised to assess.</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#1fb8d6;color:#06111f;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${esc(label)}</a></p>`;

export function assessmentReceivedEmail(p: { businessName: string; name: string; domain: string; reportUrl: string }) {
  const subject = "Your VibeSec Security Health Check Has Started";
  const html = layout(
    p.businessName,
    `<p>Hi ${esc(p.name)},</p><p>We've started a preliminary, passive security health check of <strong>${esc(p.domain)}</strong>. It usually completes within a minute.</p>${button(p.reportUrl, "Follow progress")}<p style="color:#5a6680;font-size:13px">Keep this link private — anyone with it can view your report.</p>`,
  );
  const text = `Hi ${p.name},\n\nWe've started a preliminary security health check of ${p.domain}.\nFollow progress: ${p.reportUrl}\n\nKeep this link private.`;
  return { subject, html, text };
}

export function assessmentCompletedEmail(p: { businessName: string; name: string; domain: string; reportUrl: string; score: number | null }) {
  const subject = "Your Website Security Health Report Is Ready";
  const scoreLine = p.score === null ? "" : `<p>Preliminary configuration score: <strong>${p.score}/100</strong></p>`;
  const html = layout(
    p.businessName,
    `<p>Hi ${esc(p.name)},</p><p>Your security health report for <strong>${esc(p.domain)}</strong> is ready.</p>${scoreLine}${button(p.reportUrl, "View your report")}<p style="color:#5a6680;font-size:13px">This is a limited automated configuration assessment, not a certification or full security audit. Keep this link private.</p>`,
  );
  const text = `Hi ${p.name},\n\nYour security health report for ${p.domain} is ready.${p.score === null ? "" : `\nScore: ${p.score}/100`}\nView it: ${p.reportUrl}\n\nKeep this link private.`;
  return { subject, html, text };
}

export function consultationAdminEmail(p: { businessName: string; name: string; email: string; company?: string; website?: string; service?: string; message: string; adminUrl: string }) {
  const subject = `New consultation request — ${p.company || p.name}`;
  const rows = [
    ["Name", p.name],
    ["Email", p.email],
    ["Company", p.company ?? ""],
    ["Website", p.website ?? ""],
    ["Service", p.service ?? ""],
  ]
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5a6680">${k}</td><td>${esc(v)}</td></tr>`)
    .join("");
  const html = layout(p.businessName, `<p>A new consultation request was submitted.</p><table>${rows}</table><p style="white-space:pre-wrap;border-left:3px solid #1fb8d6;padding-left:12px">${esc(p.message)}</p>${button(p.adminUrl, "Open in dashboard")}`);
  const text = `New consultation request\nName: ${p.name}\nEmail: ${p.email}\nCompany: ${p.company ?? ""}\nWebsite: ${p.website ?? ""}\nService: ${p.service ?? ""}\n\n${p.message}\n\n${p.adminUrl}`;
  return { subject, html, text };
}

export function adminLeadEmail(p: { businessName: string; name: string; company: string; domain: string; priority: string; score: number | null; adminUrl: string }) {
  const subject = `New Priority ${p.priority} lead — ${p.company} (${p.domain})`;
  const html = layout(
    p.businessName,
    `<p>A new lead completed a security health check.</p><p><strong>${esc(p.name)}</strong> · ${esc(p.company)}<br/>Website: ${esc(p.domain)}<br/>Priority: ${esc(p.priority)}${p.score === null ? "" : `<br/>Score: ${p.score}/100`}</p>${button(p.adminUrl, "Open lead")}`,
  );
  const text = `New Priority ${p.priority} lead\n${p.name} · ${p.company}\nWebsite: ${p.domain}\n${p.adminUrl}`;
  return { subject, html, text };
}
