"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDateOnly } from "@/lib/utils";
import Image from "next/image";

interface WarningItem {
  id: string;
  reason: string;
  photoUrl?: string | null;
  isArchived?: boolean;
  archivedAt?: string | null;
  archivedBy?: { id: string; name: string | null } | null;
  createdAt: string;
  reportedBy?: { id: string; name: string | null } | null;
}

interface WarningsListProps {
  userId: string;
  archived?: boolean;
  canArchive?: boolean;
  refreshKey?: number;
}

export function WarningsList({ userId, archived = false, canArchive = false, refreshKey = 0 }: WarningsListProps) {
  const [warnings, setWarnings] = useState<WarningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWarnings() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/users/${userId}/warnings?archived=${archived ? "true" : "false"}`);
        if (!response.ok) {
          throw new Error("Failed to fetch warnings");
        }
        const data = await response.json();
        setWarnings(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch warnings");
        toast.error("Failed to load warnings");
      } finally {
        setLoading(false);
      }
    }

    fetchWarnings();
  }, [userId, archived, refreshKey]);

  const toggleArchive = async (warningId: string, nextArchived: boolean) => {
    try {
      setArchivingId(warningId);
      const response = await fetch(`/api/users/${userId}/warnings/${warningId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: nextArchived }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "Failed to update warning");
      }
      toast.success(nextArchived ? "Warning archived" : "Warning unarchived");
      // Refresh list
      const refreshed = await fetch(`/api/users/${userId}/warnings?archived=${archived ? "true" : "false"}`);
      if (refreshed.ok) {
        setWarnings(await refreshed.json());
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to update warning");
    } finally {
      setArchivingId(null);
    }
  };

  if (loading) {
    return <div className="p-4">Loading warnings...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (warnings.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        {archived ? "No archived warnings." : "No active warnings."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {warnings.map((w) => (
        <div key={w.id} className="border rounded-lg p-4 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {formatDateOnly(w.createdAt)}
                {w.reportedBy?.name ? ` · Reported by ${w.reportedBy.name}` : ""}
                {archived && (w.archivedBy?.name || w.archivedAt)
                  ? ` · Archived${w.archivedBy?.name ? ` by ${w.archivedBy.name}` : ""}${
                      w.archivedAt ? ` on ${formatDateOnly(w.archivedAt)}` : ""
                    }`
                  : ""}
              </p>
              <p className="text-sm">{w.reason}</p>
            </div>
            <div className="flex items-center gap-2">
              {w.photoUrl ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={w.photoUrl} target="_blank" rel="noreferrer">
                    View Photo
                  </a>
                </Button>
              ) : null}
              {canArchive ? (
                <Button
                  variant={archived ? "outline" : "secondary"}
                  size="sm"
                  onClick={() => toggleArchive(w.id, !archived)}
                  disabled={archivingId === w.id}
                >
                  {archivingId === w.id ? "..." : archived ? "Unarchive" : "Archive"}
                </Button>
              ) : null}
            </div>
          </div>

          {w.photoUrl ? (
            // Small preview (kept minimal to avoid layout issues)
            <div className="pt-2">
              <div className="relative h-40 w-full overflow-hidden rounded-md border bg-muted">
                <Image
                  src={w.photoUrl}
                  alt="Warning evidence"
                  fill
                  sizes="(max-width: 768px) 100vw, 640px"
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

