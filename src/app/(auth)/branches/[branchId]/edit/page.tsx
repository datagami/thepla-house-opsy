import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BranchEditForm } from "@/components/branches/branch-edit-form";
import { BranchDocumentUpload } from "@/components/branches/branch-document-upload";
import { BranchDocumentsList } from "@/components/branches/branch-documents-list";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Edit Branch - HRMS",
  description: "Edit branch details in the HRMS system",
};

interface Props {
  params: Promise<{
    branchId: string;
  }>;
}

export default async function EditBranchPage({ params }: Props) {
  const session = await auth();

  // @ts-expect-error - We check for MANAGEMENT role
  if (!session || session.user.role !== "MANAGEMENT") {
    redirect("/dashboard");
  }

  const { branchId } = await params;

  const [branch, documentTypes] = await Promise.all([
    prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        _count: {
          select: {
            users: true,
            managers: true,
          },
        },
      },
    }),
    prisma.documentType.findMany({
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  if (!branch) {
    notFound();
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Edit Branch</h2>
          <p className="text-muted-foreground">
            Update branch information and details.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <BranchEditForm branch={branch} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold">Upload Documents</h3>
          <BranchDocumentUpload branchId={branch.id} branchName={branch.name} documentTypes={documentTypes} />
        </div>
        <BranchDocumentsList branchId={branch.id} canUpload={true} branchName={branch.name} />
      </div>
    </div>
  );
} 