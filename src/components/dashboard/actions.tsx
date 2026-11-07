"use client";

import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/client-api";
import { CONSULTATION_STATUSES, LEAD_STATUS_LABELS, LEAD_STATUSES } from "@/lib/validation/schemas";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const run = async (url: string, body: unknown, method = "POST", okText = "Saved.") => {
    setBusy(true);
    setMsg(null);
    const res = await postJson<Record<string, unknown>>(url, body, { method });
    setBusy(false);
    if (res.ok) {
      setMsg({ kind: "ok", text: okText });
      router.refresh();
      return res.data;
    }
    setMsg({ kind: "err", text: res.error.message });
    return null;
  };
  return { busy, msg, run, setMsg };
}

export function LeadEditor({ lead }: { lead: { id: string; status: string; priority: string; owner: string | null; sales_notes: string | null } }) {
  const { busy, msg, run } = useAction();
  const [status, setStatus] = useState(lead.status);
  const [priority, setPriority] = useState(lead.priority);
  const [owner, setOwner] = useState(lead.owner ?? "");
  const [notes, setNotes] = useState(lead.sales_notes ?? "");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="status" label="Status" required>
          <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
          </Select>
        </Field>
        <Field id="priority" label="Priority" required>
          <Select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {["A", "B", "C"].map((p) => <option key={p} value={p}>Priority {p}</option>)}
          </Select>
        </Field>
        <Field id="owner" label="Internal owner">
          <Input id="owner" value={owner} maxLength={120} onChange={(e) => setOwner(e.target.value)} />
        </Field>
      </div>
      <Field id="sales_notes" label="Sales notes">
        <Textarea id="sales_notes" value={notes} maxLength={10000} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Button disabled={busy} onClick={() => run(`/api/admin/leads/${lead.id}`, { status, priority, owner, salesNotes: notes }, "PATCH")}>
        {busy && <Loader2 className="animate-spin" />} Save changes
      </Button>
      <div className="space-y-2 border-t pt-4">
        <Field id="note" label="Add a timeline note">
          <Textarea id="note" value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} className="min-h-[70px]" />
        </Field>
        <Button
          variant="secondary"
          disabled={busy || !note.trim()}
          onClick={async () => {
            if (await run(`/api/admin/leads/${lead.id}`, { note }, "PATCH", "Note added.")) setNote("");
          }}
        >
          Add note
        </Button>
      </div>
      {msg && <Alert variant={msg.kind === "ok" ? "success" : "destructive"}>{msg.text}</Alert>}
    </div>
  );
}

export function DeleteLeadButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Permanently delete this lead and all associated assessments, reports, notes and consent records?")) return;
        setBusy(true);
        const res = await postJson(`/api/admin/leads/${id}`, {}, { method: "DELETE" });
        if (res.ok) router.replace("/admin/leads");
        else {
          setBusy(false);
          alert(res.error.message);
        }
      }}
    >
      <Trash2 /> Delete lead
    </Button>
  );
}

export function ReportActions({ id, completed }: { id: string; completed: boolean }) {
  const { busy, msg, run, setMsg } = useAction();
  const [link, setLink] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {completed && <a className="inline-flex h-8 items-center rounded-md bg-secondary px-3 text-xs font-semibold hover:bg-secondary/80" href={`/api/admin/reports/${id}/pdf`}>Download PDF</a>}
        <Button size="sm" variant="secondary" disabled={busy} onClick={async () => {
          const d = await run(`/api/admin/reports/${id}`, { action: "rotate_link" }, "POST", "New private link generated. Previous links no longer work.");
          if (d?.reportUrl) setLink(String(d.reportUrl));
        }}>New report link</Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => {
          if (confirm("Re-run the passive checks for this website now?")) void run(`/api/admin/reports/${id}`, { action: "rescan" }, "POST", "Assessment re-run requested.");
        }}><RefreshCw /> Regenerate</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => {
          if (confirm("Revoke this report link? The visitor will no longer be able to open it.")) void run(`/api/admin/reports/${id}`, { action: "revoke" }, "POST", "Report link revoked.");
        }}>Revoke link</Button>
      </div>
      {link && (
        <Alert className="break-all text-xs">
          Copy this link now — it is shown only once: <span className="font-mono">{link}</span>{" "}
          <button className="text-cyan-400 underline" onClick={() => { void navigator.clipboard.writeText(link); setMsg({ kind: "ok", text: "Copied." }); }}>Copy</button>
        </Alert>
      )}
      {msg && <p className={msg.kind === "ok" ? "text-xs text-emerald-300" : "text-xs text-red-300"}>{msg.text}</p>}
    </div>
  );
}

export function ConsultationStatus({ id, status }: { id: string; status: string }) {
  const { busy, run } = useAction();
  return (
    <Select aria-label="Contact status" defaultValue={status} disabled={busy} className="h-9 min-w-[150px] text-xs" onChange={(e) => run(`/api/admin/consultations/${id}`, { status: e.target.value }, "PATCH")}>
      {CONSULTATION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
    </Select>
  );
}

export function DeletionRequestActions({ id, email }: { id: string; email: string }) {
  const { busy, msg, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="destructive" disabled={busy} onClick={() => {
        if (confirm(`Permanently delete ALL leads, assessments, reports and consultation requests for ${email}?`)) void run(`/api/admin/deletion-requests/${id}`, { action: "complete" }, "POST", "Data deleted.");
      }}>Delete data</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run(`/api/admin/deletion-requests/${id}`, { action: "reject" }, "POST", "Request rejected.")}>Reject</Button>
      {msg && <span className="text-xs text-muted-foreground">{msg.text}</span>}
    </div>
  );
}
