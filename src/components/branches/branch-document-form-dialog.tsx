"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BranchDocument, DocumentType } from "@/models/models";

const NO_TYPE = "__none__";

/** Fired after a successful create/edit so the (client-fetched) documents list refetches. */
export const BRANCH_DOCUMENTS_CHANGED = "branch-documents:changed";

const documentFormSchema = z.object({
  name: z.string().min(2, "Document name must be at least 2 characters"),
  description: z.string().optional(),
  documentTypeId: z.string().optional(),
  renewalDate: z.date({ required_error: "Renewal date is required" }),
  reminderDate: z.date({ required_error: "Reminder date is required" }),
});

type FormValues = z.infer<typeof documentFormSchema>;

interface BranchDocumentFormDialogProps {
  branchId: string;
  documentTypes?: DocumentType[];
  mode: "create" | "edit";
  /** Required in edit mode — the document to pre-fill and update. */
  document?: BranchDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BranchDocumentFormDialog({
  branchId,
  documentTypes = [],
  mode,
  document,
  open,
  onOpenChange,
}: BranchDocumentFormDialogProps) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: { name: "", description: "", documentTypeId: NO_TYPE },
  });

  // Pre-fill (edit) or clear (create) whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setSelectedFile(null);
    if (isEdit && document) {
      form.reset({
        name: document.name,
        description: document.description ?? "",
        documentTypeId: document.documentTypeId ?? NO_TYPE,
        renewalDate: new Date(document.renewalDate),
        reminderDate: new Date(document.reminderDate),
      });
    } else {
      form.reset({ name: "", description: "", documentTypeId: NO_TYPE });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, document?.id]);

  const onSubmit = async (values: FormValues) => {
    if (!isEdit && !selectedFile) {
      toast.error("Please select a file");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("description", values.description || "");
      formData.append(
        "documentTypeId",
        values.documentTypeId && values.documentTypeId !== NO_TYPE ? values.documentTypeId : ""
      );
      formData.append("renewalDate", values.renewalDate.toISOString());
      formData.append("reminderDate", values.reminderDate.toISOString());
      if (selectedFile) formData.append("file", selectedFile);

      const url = isEdit
        ? `/api/branches/${branchId}/documents/${document!.id}`
        : `/api/branches/${branchId}/documents`;
      const response = await fetch(url, { method: isEdit ? "PATCH" : "POST", body: formData });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Failed to ${isEdit ? "update" : "upload"} document`);
      }

      toast.success(isEdit ? "Document updated" : "Document uploaded successfully");
      onOpenChange(false);
      setSelectedFile(null);
      form.reset();
      // Refresh the client-fetched documents list, and any server-rendered
      // document-dependent UI (reminder banners, dashboard counts).
      window.dispatchEvent(new CustomEvent(BRANCH_DOCUMENTS_CHANGED, { detail: { branchId } }));
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to save document");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Document" : "Upload Branch Document"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the document details, or replace the file to record a new version."
              : "Add a document with its renewal and reminder dates."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="License Certificate" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Brief description of the document" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="documentTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Type (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || NO_TYPE}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a document type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_TYPE}>No type</SelectItem>
                      {documentTypes.map((docType) => (
                        <SelectItem key={docType.id} value={docType.id}>
                          <div className="flex items-center gap-2">
                            <span>{docType.name}</span>
                            {docType.mandatory && <span className="text-xs text-red-500">*</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <label className="block text-sm font-medium mb-2">
                {isEdit ? "Replace file (optional)" : "File"}
              </label>
              <FileDropzone
                variant="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.zip"
                maxSizeMB={10}
                value={selectedFile ? [selectedFile] : []}
                onFiles={(fs) => setSelectedFile(fs[0] ?? null)}
                onRemoveFile={() => setSelectedFile(null)}
                idleText="Drag & drop a file, or click to browse"
                hint="PDF, image, or ZIP — up to 10MB"
                disabled={isLoading}
              />
              {isEdit && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave empty to keep the current file: {document?.fileName}
                </p>
              )}
            </div>

            <FormField
              control={form.control}
              name="renewalDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Renewal Date</FormLabel>
                  <FormControl>
                    <DateInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reminderDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reminder Date</FormLabel>
                  <FormControl>
                    <DateInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEdit ? "Saving..." : "Uploading..."}
                  </>
                ) : isEdit ? (
                  "Save Changes"
                ) : (
                  "Upload Document"
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
