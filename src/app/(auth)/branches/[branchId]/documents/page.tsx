import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BranchDocumentsList } from "@/components/branches/branch-documents-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Branch Documents - HRMS",
  description: "View branch documents and manage renewals",
};

interface Props {
  params: Promise<{
    branchId: string;
  }>;
}

export default async function BranchDocumentsPage({ params }: Props) {
  const session = await auth();

  // @ts-expect-error - We check for MANAGEMENT and BRANCH_MANAGER roles
  if (!session || !['MANAGEMENT', 'BRANCH_MANAGER'].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { branchId } = await params;

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: {
      _count: {
        select: {
          users: true,
          managers: true,
        },
      },
    },
  });

  if (!branch) {
    notFound();
  }

  // For BRANCH_MANAGER, check if they manage this branch
  // @ts-expect-error - role is not in the User type
  if (session.user.role === "BRANCH_MANAGER") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { managedBranchId: true },
    });

    if (user?.managedBranchId !== branchId) {
      redirect("/dashboard");
    }
  }

  // @ts-expect-error - role is not in the User type
  const canUpload = session.user.role === "MANAGEMENT";

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Branch Documents</h2>
          <p className="text-muted-foreground">
            Manage documents for {branch.name} branch.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {branch.name} - Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BranchDocumentsList branchId={branch.id} canUpload={canUpload} />
        </CardContent>
      </Card>
    </div>
  );
} 