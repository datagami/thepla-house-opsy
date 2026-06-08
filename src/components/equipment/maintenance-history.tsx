"use client";

import { FileText, User, Phone } from "lucide-react";
import { TypeBadge, DoneBadge } from "@/components/equipment/ui";
import { formatINR } from "@/lib/equipment-display";
import { format } from "date-fns";

export interface HistoryRecord {
  id: string;
  serviceDate: string;
  maintenanceType: string;
  issue: string | null;
  vendorName: string | null;
  vendorContact: string | null;
  cost: number;
  status: string;
  remarks: string | null;
  billUrl: string | null;
  photoUrls: string[];
  loggedBy: { name: string | null } | null;
}

interface MaintenanceHistoryProps {
  records: HistoryRecord[];
}

function BillThumb({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="group">
      <div
        className="flex h-10 w-10 flex-col items-center justify-center gap-[3px] rounded-lg border bg-white transition-shadow group-hover:shadow-md"
        style={{ borderColor: "#e4e4e7" }}
      >
        <FileText size={17} style={{ color: "#dc2626" }} />
        <span
          className="font-bold tracking-wide"
          style={{ fontSize: 7.5, color: "#b91c1c" }}
        >
          PDF
        </span>
      </div>
    </a>
  );
}

function PhotoThumb({ url, index }: { url: string; index: number }) {
  const gradients = [
    "linear-gradient(135deg,#e4e4e7,#a1a1aa)",
    "linear-gradient(135deg,#e5e7eb,#9ca3af)",
    "linear-gradient(135deg,#e7e5e4,#a8a29e)",
    "linear-gradient(135deg,#e2e8f0,#94a3b8)",
  ];
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="group">
      <div
        className="relative h-10 w-10 flex-none overflow-hidden rounded-lg border transition-shadow group-hover:shadow-md"
        style={{
          borderColor: "#e4e4e7",
          background: gradients[index % gradients.length],
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`Photo ${index + 1}`}
          className="h-full w-full object-cover"
        />
      </div>
    </a>
  );
}

function HistoryEntry({
  record,
  isLast,
}: {
  record: HistoryRecord;
  isLast: boolean;
}) {
  const hasAttachments = record.billUrl || record.photoUrls.length > 0;
  const formattedDate = format(new Date(record.serviceDate), "d MMM yyyy");

  return (
    <div
      className="flex gap-2.5 md:gap-3.5"
      style={{ paddingBottom: isLast ? 0 : 14, position: "relative" }}
    >
      {/* Timeline rail */}
      <div
        className="relative flex flex-none justify-center"
        style={{ width: 24 }}
      >
        {/* Vertical line */}
        {!isLast && (
          <div
            className="absolute left-1/2 top-7 -translate-x-1/2"
            style={{
              width: 1.5,
              bottom: -14,
              background: "#e4e4e7",
            }}
          />
        )}
        {/* Dot */}
        <div
          className="relative z-10 flex h-7 w-7 flex-none items-center justify-center rounded-full border bg-white"
          style={{ borderColor: "#e4e4e7" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a1a1aa"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="p-4">
          {/* Top row: badges + cost */}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {/* Type badge + date + done badge */}
              <div className="flex flex-wrap items-center gap-[9px]">
                <TypeBadge type={record.maintenanceType} />
                <span
                  className="font-[550] tabular-nums"
                  style={{ fontSize: 12.5, color: "#71717a" }}
                >
                  {formattedDate}
                </span>
                <DoneBadge status={record.status} />
              </div>

              {/* Issue */}
              {record.issue && (
                <div
                  className="mt-[9px] font-semibold text-foreground"
                  style={{ fontSize: 13.5 }}
                >
                  {record.issue}
                </div>
              )}

              {/* Remarks */}
              {record.remarks && (
                <div
                  className="mt-[3px] leading-[1.5] text-muted-foreground"
                  style={{ fontSize: 12.5 }}
                >
                  {record.remarks}
                </div>
              )}

              {/* Vendor row */}
              <div
                className="mt-[11px] flex flex-wrap items-center gap-[14px]"
                style={{ fontSize: 12.5 }}
              >
                {record.vendorName && (
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <User size={13} style={{ color: "#a1a1aa" }} />
                    {record.vendorName}
                  </span>
                )}
                {record.vendorContact && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Phone size={13} style={{ color: "#a1a1aa" }} />
                    {record.vendorContact}
                  </span>
                )}
              </div>
            </div>

            {/* Cost */}
            <div className="flex-none text-right">
              <div
                className="font-bold tabular-nums tracking-[-0.01em]"
                style={{ fontSize: 16 }}
              >
                {formatINR(record.cost)}
              </div>
            </div>
          </div>

          {/* Attachments */}
          {hasAttachments && (
            <div
              className="mt-[13px] flex flex-wrap items-center gap-2 border-t pt-[13px]"
              style={{ borderColor: "#f4f4f5" }}
            >
              {record.billUrl && (
                <div className="flex items-center gap-2">
                  <BillThumb url={record.billUrl} />
                  <div>
                    <div className="font-semibold" style={{ fontSize: 11.5 }}>
                      Bill
                    </div>
                    <div
                      className="max-w-[130px] truncate text-muted-foreground"
                      style={{ fontSize: 11 }}
                    >
                      {record.billUrl.split("/").pop() ?? "bill.pdf"}
                    </div>
                  </div>
                </div>
              )}
              {record.photoUrls.length > 0 && (
                <div
                  className="flex items-center gap-1.5"
                  style={{ marginLeft: record.billUrl ? 8 : 0 }}
                >
                  {record.photoUrls.slice(0, 4).map((url, k) => (
                    <PhotoThumb key={k} url={url} index={k} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MaintenanceHistory({ records }: MaintenanceHistoryProps) {
  return (
    <div className="relative flex flex-col gap-0">
      {records.map((record, i) => (
        <HistoryEntry
          key={record.id}
          record={record}
          isLast={i === records.length - 1}
        />
      ))}
    </div>
  );
}
