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

interface AdvancePaymentFormProps {
  userId: string | null | undefined;
  userName: string | null | undefined;
  onSuccess?: () => void;
}

export function AdvancePaymentForm({ userId, userName, onSuccess }: AdvancePaymentFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const amount = parseFloat(formData.get("amount") as string);
    const emiAmount = parseFloat(formData.get("emiAmount") as string);
    const reason = formData.get("reason") as string;

    try {
      const response = await fetch(`/api/users/${userId}/advance-payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          emiAmount,
          reason,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit advance payment");

      toast.success("Advance payment created successfully");
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.log(error);
      toast.error("Failed to create advance payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Advance Payment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Advance Payment for {userName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Total Amount</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              required
              placeholder="Enter total amount"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emiAmount">EMI Amount</Label>
            <Input
              id="emiAmount"
              name="emiAmount"
              type="number"
              step="0.01"
              required
              placeholder="Enter EMI amount"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              name="reason"
              required
              placeholder="Enter reason for advance payment"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Advance Payment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
} 
