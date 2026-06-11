"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileDropzone } from "@/components/ui/file-dropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface WarningType {
  id: string;
  name: string;
  description?: string | null;
}

interface WarningFormProps {
  userId: string;
  userName?: string | null;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function WarningForm({ userId, userName, onSuccess, trigger, open: externalOpen, onOpenChange: externalOnOpenChange }: WarningFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [warningTypes, setWarningTypes] = useState<WarningType[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [photo, setPhoto] = useState<File | null>(null);

  // Use external control if provided, otherwise use internal state
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? (externalOnOpenChange || (() => {})) : setInternalOpen;

  useEffect(() => {
    if (open) {
      fetchWarningTypes();
    }
  }, [open]);

  async function fetchWarningTypes() {
    setLoadingTypes(true);
    try {
      const response = await fetch("/api/warning-types");
      if (!response.ok) {
        throw new Error("Failed to fetch warning types");
      }
      const types = await response.json();
      setWarningTypes(types);
    } catch (error) {
      console.error("Error fetching warning types:", error);
      toast.error("Failed to load warning types");
    } finally {
      setLoadingTypes(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formEl = event.currentTarget;
    try {
      const formData = new FormData(formEl);
      const reason = (formData.get("reason") as string | null)?.trim();

      if (!selectedType) {
        toast.error("Warning type is required");
        return;
      }

      const payload = new FormData();
      payload.append("warningTypeId", selectedType);
      payload.append("reason", reason || "");

      if (photo) {
        payload.append("file", photo);
      }

      const response = await fetch(`/api/users/${userId}/warnings`, {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "Failed to create warning");
      }

      toast.success("Warning registered");
      formEl.reset();
      setPhoto(null);
      setSelectedType("");
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to create warning");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined && (
        <DialogTrigger asChild>
          {trigger ?? <Button>Register Warning</Button>}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Register Warning{userName ? ` for ${userName}` : ""}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="warningType">
              Warning Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedType}
              onValueChange={setSelectedType}
              disabled={loadingTypes}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingTypes ? "Loading..." : "Select warning type"} />
              </SelectTrigger>
              <SelectContent>
                {warningTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Additional Notes (optional)</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Add any additional details or context..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Photo (optional)</Label>
            <FileDropzone
              variant="image"
              accept="image/*"
              maxSizeMB={5}
              value={photo ? [photo] : []}
              onFiles={(fs) => setPhoto(fs[0] ?? null)}
              onRemoveFile={() => setPhoto(null)}
              idleText="Drag & drop a photo, or click to browse"
              hint="Image up to 5MB"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Warning"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

