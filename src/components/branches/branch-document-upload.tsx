"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { DocumentType } from "@/models/models";
import { BranchDocumentFormDialog } from "@/components/branches/branch-document-form-dialog";

interface BranchDocumentUploadProps {
  branchId: string;
  branchName?: string;
  documentTypes?: DocumentType[];
}

export function BranchDocumentUpload({ branchId, documentTypes = [] }: BranchDocumentUploadProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Upload Document
      </Button>
      <BranchDocumentFormDialog
        mode="create"
        branchId={branchId}
        documentTypes={documentTypes}
        open={isOpen}
        onOpenChange={setIsOpen}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
