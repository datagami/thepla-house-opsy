"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface WarningFormProps {
  userId: string;
  userName?: string | null;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function WarningForm({ userId, userName, onSuccess, trigger }: WarningFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formEl = event.currentTarget;
    try {
      const formData = new FormData(formEl);
      const reason = (formData.get("reason") as string | null)?.trim();
      const file = fileRef.current?.files?.[0];

      if (!reason) {
        toast.error("Reason is required");
        return;
      }

      const payload = new FormData();
      payload.append("reason", reason);

      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error("Photo size must be less than 5MB");
          return;
        }
        if (!file.type.startsWith("image/")) {
          toast.error("Photo must be an image");
          return;
        }
        payload.append("file", file);
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
      if (fileRef.current) fileRef.current.value = "";
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
      <DialogTrigger asChild>
        {trigger ?? <Button>Register Warning</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Register Warning{userName ? ` for ${userName}` : ""}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              name="reason"
              required
              placeholder='e.g. "Uniform not worn", "Nails not cut", "Beard not trimmed"'
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">Photo (optional)</Label>
            <Input id="file" name="file" type="file" accept="image/*" ref={fileRef} />
            <p className="text-xs text-muted-foreground">Supported formats: JPG/PNG/GIF. Max size: 5MB</p>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Warning"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

