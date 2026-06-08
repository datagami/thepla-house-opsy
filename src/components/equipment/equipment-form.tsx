"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ALL_CATEGORIES, categoryLabel } from "@/lib/equipment-display";

interface BranchOption {
  id: string;
  name: string;
}

interface EquipmentFormValues {
  id?: string;
  name?: string;
  category?: string;
  branchId?: string;
  location?: string | null;
  frequencyMonths?: number | null;
  reminderLeadDays?: number;
  notes?: string | null;
}

interface EquipmentFormState {
  name: string;
  category: string;
  branchId: string;
  location: string;
  frequencyMonths: string;
  reminderLeadDays: string;
  notes: string;
}

export function EquipmentForm({
  branches,
  defaultBranchId,
  initial,
}: {
  branches: BranchOption[];
  defaultBranchId?: string;
  initial?: EquipmentFormValues;
}) {
  const router = useRouter();
  const isEdit = !!initial?.id;

  const firstBranchId = branches[0]?.id ?? "";
  const lockedBranchId = defaultBranchId ?? (branches.length === 1 ? branches[0]?.id : undefined);

  const [form, setForm] = useState<EquipmentFormState>({
    name: initial?.name ?? "",
    category: initial?.category ?? "OTHER",
    branchId: initial?.branchId ?? defaultBranchId ?? firstBranchId,
    location: initial?.location ?? "",
    frequencyMonths:
      initial?.frequencyMonths != null ? String(initial.frequencyMonths) : "",
    reminderLeadDays:
      initial?.reminderLeadDays != null ? String(initial.reminderLeadDays) : "15",
    notes: initial?.notes ?? "",
  });

  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof EquipmentFormState, v: string) =>
    setForm((s) => ({ ...s, [k]: v }));

  const branchLocked = !!lockedBranchId || branches.length === 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSubmitting(true);
    try {
      const frequencyMonths =
        form.frequencyMonths.trim() === ""
          ? null
          : Number(form.frequencyMonths);
      const reminderLeadDays = Number(form.reminderLeadDays) || 15;

      const body = {
        name: form.name.trim(),
        category: form.category,
        branchId: form.branchId,
        location: form.location.trim() || undefined,
        frequencyMonths: frequencyMonths ?? undefined,
        reminderLeadDays,
        notes: form.notes.trim() || undefined,
      };

      const url = isEdit
        ? `/api/equipment/${initial!.id}`
        : "/api/equipment";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Something went wrong");
      }

      toast.success(isEdit ? "Item updated" : "Item added");
      router.push("/equipment");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Item name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Chest Freezer — Blue Star 300L"
              required
            />
          </div>

          {/* Category + Outlet — 2-col grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="category">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.category}
                onValueChange={(v) => set("category", v)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {categoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branchId">
                Outlet <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.branchId}
                onValueChange={(v) => set("branchId", v)}
                disabled={branchLocked}
              >
                <SelectTrigger id="branchId">
                  <SelectValue placeholder="Select outlet" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Kitchen area / location */}
          <div className="space-y-1.5">
            <Label htmlFor="location">Kitchen area / location</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="e.g. Tandoor station, Cold storage…"
            />
          </div>

          {/* Service frequency + Reminder lead — 2-col grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="frequencyMonths">Service frequency</Label>
              <div className="relative">
                <Input
                  id="frequencyMonths"
                  value={form.frequencyMonths}
                  onChange={(e) =>
                    set("frequencyMonths", e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="12"
                  inputMode="numeric"
                  className="pr-16"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  months
                </span>
              </div>
              <p className="text-[11.5px] text-muted-foreground">
                Leave blank for one-off / ad-hoc items
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reminderLeadDays">Reminder lead time</Label>
              <div className="relative">
                <Input
                  id="reminderLeadDays"
                  value={form.reminderLeadDays}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    if (v === "" || (Number(v) >= 0 && Number(v) <= 365)) {
                      set("reminderLeadDays", v);
                    }
                  }}
                  placeholder="15"
                  inputMode="numeric"
                  className="pr-12"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  days
                </span>
              </div>
              <p className="text-[11.5px] text-muted-foreground">
                How many days before the due date to start reminding
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Compliance notes, vendor preference, model number…"
              className="min-h-[80px] resize-y"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!form.name.trim() || submitting}
            >
              {submitting
                ? isEdit
                  ? "Saving…"
                  : "Adding…"
                : isEdit
                ? "Save changes"
                : "Add item"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
