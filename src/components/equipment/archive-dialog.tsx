"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Archive } from "lucide-react";
import { setEquipmentStatus } from "@/lib/equipment-actions";

export function ArchiveDialog({
  equipmentId, equipmentName, hasImage = false, open, onOpenChange,
}: { equipmentId: string; equipmentName: string; hasImage?: boolean; open: boolean; onOpenChange: (o: boolean) => void; }) {
  const router = useRouter();
  const [counts, setCounts] = useState<{ photos: number; bills: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setCounts(null); return; }
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/equipment/${equipmentId}/records`);
        if (!res.ok) throw new Error();
        const recs: Array<{ billUrl: string | null; photoUrls: string[] }> = await res.json();
        if (!active) return;
        setCounts({
          photos: recs.reduce((n, r) => n + (r.photoUrls?.length ?? 0), 0),
          bills: recs.filter((r) => !!r.billUrl).length,
        });
      } catch { if (active) setCounts({ photos: 0, bills: 0 }); }
    })();
    return () => { active = false; };
  }, [open, equipmentId]);

  async function confirmArchive() {
    setBusy(true);
    try {
      await setEquipmentStatus(equipmentId, "RETIRED");
      toast.success("Item archived; attached files deleted from storage");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to archive");
    } finally { setBusy(false); }
  }

  const hasBills = (counts?.bills ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive “{equipmentName}”?</DialogTitle>
          <DialogDescription>
            Archiving will mark this item inactive and <strong>permanently delete</strong>{" "}
            {counts
              ? `${counts.photos} photo(s) and ${counts.bills} bill(s)${hasImage ? ", and the asset photo" : ""}`
              : `all attached photos and bills${hasImage ? ", and the asset photo" : ""}`}{" "}
            from storage to free space. This cannot be undone — restoring the item later will not recover the files.
          </DialogDescription>
        </DialogHeader>
        {hasBills && (
          <a
            href={`/api/equipment/${equipmentId}/bills/export`}
            className="inline-flex w-fit items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-[13px] font-medium transition-colors hover:bg-accent"
          >
            <Download size={15} /> Download bills (.zip) first
          </a>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={busy || counts === null} onClick={confirmArchive}>
            <Archive size={15} className="mr-1.5" />
            {busy ? "Archiving…" : "Archive & delete files"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
