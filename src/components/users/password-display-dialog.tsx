"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PasswordDisplayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  password: string;
  userName?: string;
  userEmail?: string;
  title?: string;
}

export function PasswordDisplayDialog({
  isOpen,
  onClose,
  password,
  userName,
  userEmail,
  title = "Password",
}: PasswordDisplayDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success("Password copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy password");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {userName && userEmail
              ? `Password for ${userName} (${userEmail})`
              : "Please save this password securely. It will not be shown again."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={password}
                readOnly
                className="font-mono text-lg"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
            <p className="text-sm text-yellow-800">
              <strong>Important:</strong> This password is shown only once. Make
              sure to copy it before closing this dialog. It cannot be retrieved
              later.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="default">
            I've Saved the Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
