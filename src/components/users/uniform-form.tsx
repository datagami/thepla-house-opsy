"use client";

import { useState } from "react";
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

interface UniformFormProps {
  userId: string | null | undefined;
  userName: string | null | undefined;
  onSuccess?: () => void;
}

const SIZES = [
  "34", "36", "38", "40", "42", "44", "46"
];

export function UniformForm({ userId, userName, onSuccess }: UniformFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const size = formData.get("size") as string;
    const notes = formData.get("notes") as string;
    const uniformNumber = formData.get("uniformNumber") as string;

    try {
      const response = await fetch(`/api/users/${userId}/uniforms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // fixed to Shirt
          size: size || undefined,
          notes: notes || undefined,
          uniformNumber,
        }),
      });

      if (!response.ok) throw new Error("Failed to issue uniform");

      toast.success("Uniform issued successfully");
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.log(error);
      toast.error("Failed to issue uniform");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Issue Uniform</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Issue Uniform (Shirt) to {userName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Item</Label>
            <Input value="Shirt" readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="uniformNumber">Uniform Number</Label>
            <Input
              id="uniformNumber"
              name="uniformNumber"
              required
              placeholder="Enter internal shirt number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="size">Size</Label>
            <Input
              id="size"
              name="size"
              placeholder="e.g. M, 40, etc."
              list="size-options"
            />
            <datalist id="size-options">
              {SIZES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Enter any additional notes"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Issuing..." : "Issue Uniform"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
} 