import Link from "next/link";
import { ConsultationStatus, DeletionRequestActions } from "@/components/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listConsultations, listDeletionRequests } from "@/lib/admin/queries";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Requests" };

export default async function ConsultationsPage() {
  const [{ rows, total }, deletions] = await Promise.all([listConsultations(1), listDeletionRequests()]);
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Consultation requests <span className="text-base font-normal text-muted-foreground">({total})</span></h1>
        <Table>
          <THead><tr><TH>Name</TH><TH>Email</TH><TH>Company</TH><TH>Website</TH><TH>Service / message</TH><TH>Submitted</TH><TH>Status</TH></tr></THead>
          <TBody>
            {rows.map((c) => (
              <TR key={c.id}>
                <TD>{c.lead_id ? <Link className="text-cyan-400 hover:underline" href={`/admin/leads/${c.lead_id}`}>{c.full_name}</Link> : c.full_name}</TD>
                <TD className="break-all"><a className="hover:underline" href={`mailto:${c.email}`}>{c.email}</a></TD>
                <TD>{c.company ?? "—"}</TD>
                <TD className="break-all">{c.website ?? "—"}</TD>
                <TD className="max-w-md"><p className="font-medium">{c.service ?? "—"}</p><p className="whitespace-pre-wrap text-muted-foreground">{c.message}</p></TD>
                <TD className="whitespace-nowrap">{formatDate(c.created_at, true)}</TD>
                <TD><ConsultationStatus id={c.id} status={c.status} /></TD>
              </TR>
            ))}
            {!rows.length && <tr><TD colSpan={7} className="py-10 text-center text-muted-foreground">No consultation requests yet.</TD></tr>}
          </TBody>
        </Table>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Data deletion requests</h2>
        <p className="text-sm text-muted-foreground">Confirm the requester controls the email address (e.g. reply from that inbox) before deleting.</p>
        <Table>
          <THead><tr><TH>Email</TH><TH>Website</TH><TH>Message</TH><TH>Submitted</TH><TH>Status</TH><TH>Actions</TH></tr></THead>
          <TBody>
            {deletions.map((d) => (
              <TR key={d.id}>
                <TD className="break-all">{d.email}</TD>
                <TD className="break-all">{d.website ?? "—"}</TD>
                <TD className="max-w-sm whitespace-pre-wrap text-muted-foreground">{d.message ?? "—"}</TD>
                <TD className="whitespace-nowrap">{formatDate(d.created_at, true)}</TD>
                <TD><Badge variant={d.status === "completed" ? "success" : d.status === "rejected" ? "outline" : "medium"}>{d.status}</Badge></TD>
                <TD>{d.status === "new" ? <DeletionRequestActions id={d.id} email={d.email} /> : formatDate(d.processed_at, true)}</TD>
              </TR>
            ))}
            {!deletions.length && <tr><TD colSpan={6} className="py-8 text-center text-muted-foreground">No deletion requests.</TD></tr>}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
