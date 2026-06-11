"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { MAINTENANCE_TYPES } from "@/lib/validations/equipment";
import { maintenanceTypeLabel } from "@/lib/equipment-display";
import { fileToBase64 } from "@/lib/file-to-base64";

interface Props {
  equipmentId: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MaintenanceRecordForm({ equipmentId }: Props) {
  const router = useRouter();

  // Field state
  const [serviceDate, setServiceDate] = useState(todayISO());
  const [maintenanceType, setMaintenanceType] = useState("SERVICE");
  const [issue, setIssue] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorContact, setVendorContact] = useState("");
  const [cost, setCost] = useState("0");
  const [status, setStatus] = useState("DONE");
  const [remarks, setRemarks] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");

  // File state
  const [bill, setBill] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);

  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Convert bill if present
      const billPayload = bill ? await fileToBase64(bill) : null;

      // Convert each photo
      const photoPayload = await Promise.all(photos.map((f) => fileToBase64(f)));

      const res = await fetch(`/api/equipment/${equipmentId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceDate,
          maintenanceType,
          issue: issue || undefined,
          vendorName: vendorName || undefined,
          vendorContact: vendorContact || undefined,
          cost: Number(cost || 0),
          status,
          remarks: remarks || undefined,
          nextDueDate: nextDueDate || null,
          bill: billPayload,
          photos: photoPayload,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Failed to log maintenance");
      }

      toast.success("Maintenance logged");
      router.push(`/equipment/${equipmentId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Row 1: Service date + Maintenance type */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="serviceDate">
                Service date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="serviceDate"
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maintenanceType">
                Maintenance type <span className="text-destructive">*</span>
              </Label>
              <Select value={maintenanceType} onValueChange={setMaintenanceType}>
                <SelectTrigger id="maintenanceType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {maintenanceTypeLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Issue / observation */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="issue">Issue / observation</Label>
            <Textarea
              id="issue"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="What was found or done? e.g. Degreased filters, motor bearing oiled…"
              className="min-h-[72px] resize-none"
            />
          </div>

          {/* Row 2: Vendor name + Vendor contact */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vendorName">Vendor name</Label>
              <Input
                id="vendorName"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g. Annapurna Kitchen Services"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vendorContact">Vendor contact</Label>
              <Input
                id="vendorContact"
                value={vendorContact}
                onChange={(e) => setVendorContact(e.target.value)}
                placeholder="+91 …"
                inputMode="tel"
              />
            </div>
          </div>

          {/* Row 3: Cost + Status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost">
                Cost{" "}
                <span className="text-[12px] font-normal text-muted-foreground">
                  Total incl. parts &amp; labour
                </span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[13px] font-medium text-muted-foreground select-none">
                  ₹
                </span>
                <Input
                  id="cost"
                  value={cost}
                  onChange={(e) =>
                    setCost(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  inputMode="numeric"
                  className="pl-7"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DONE">Done</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Remarks */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remarks">Remarks</Label>
            <Input
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any note for the next service…"
            />
          </div>

          {/* Next due date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nextDueDate">
              Next due date{" "}
              <span className="text-[12px] font-normal text-muted-foreground">
                Auto-fills from item frequency if left blank
              </span>
            </Label>
            <Input
              id="nextDueDate"
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              disabled={status !== "DONE"}
            />
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Bill / invoice upload */}
          <div className="flex flex-col gap-1.5">
            <Label>Bill / invoice</Label>
            <FileDropzone
              variant="auto"
              accept="application/pdf,image/*"
              maxSizeMB={10}
              value={bill ? [bill] : []}
              onFiles={(fs) => setBill(fs[0] ?? null)}
              onRemoveFile={() => setBill(null)}
              idleText={<>Drop bill / invoice, or <span className="text-primary">browse</span></>}
              hint="PDF or image, up to 10MB"
            />
          </div>

          {/* Service photos upload */}
          <div className="flex flex-col gap-1.5">
            <Label>Service photos</Label>
            <FileDropzone
              variant="image"
              accept="image/*"
              multiple
              maxSizeMB={10}
              value={photos}
              onFiles={(fs) => setPhotos((p) => [...p, ...fs])}
              onRemoveFile={(i) => setPhotos((p) => p.filter((_, idx) => idx !== i))}
              idleText={<>Add service photos, or <span className="text-primary">browse</span></>}
              hint="Add one or more photos"
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
