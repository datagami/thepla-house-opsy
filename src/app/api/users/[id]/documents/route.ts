import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AzureStorageService } from "@/lib/azure-storage";

const USER_DOCUMENTS_FOLDER = 'user-documents';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    // @ts-expect-error - role is not in the User type
    const role = session.user.role;
    if (!session || !['MANAGEMENT', 'HR', 'BRANCH_MANAGER'].includes(role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, branchId: true } });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Branch manager can only upload for users in their branch
    if (role === 'BRANCH_MANAGER') {
      const manager = await prisma.user.findUnique({ where: { id: session.user!.id as string }, select: { managedBranchId: true, branchId: true } });
      const managerBranchId = manager?.managedBranchId ?? manager?.branchId;
      if (!managerBranchId || managerBranchId !== user.branchId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const documentTypeId = formData.get("documentTypeId") as string;

    if (!file || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/zip',
      'application/x-zip-compressed'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF, images, and ZIP files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // If a documentTypeId is provided, ensure it is USER scoped
    if (documentTypeId) {
      const docType = await prisma.documentType.findUnique({ where: { id: documentTypeId } });
      if (!docType || docType.scope !== 'USER') {
        return NextResponse.json({ error: 'Invalid document type for user documents' }, { status: 400 });
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const azureStorage = new AzureStorageService();
    const filename = `${id}-${Date.now()}-${file.name}`;
    const fileUrl = await azureStorage.uploadImage(buffer, filename, USER_DOCUMENTS_FOLDER, file.type);

    const uploadedById = session.user!.id as string;

    const document = await prisma.userDocument.create({
      data: {
        name,
        description: description || null,
        fileName: file.name,
        fileUrl,
        fileSize: file.size,
        fileType: file.type,
        uploadedById,
        userId: id,
        documentTypeId: documentTypeId || null,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true },
        },
        documentType: {
          select: { id: true, name: true, mandatory: true, scope: true },
        },
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error uploading user document:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Permissions: user can see own docs; managers/HR/management can view; branch managers limited to branch
    // @ts-expect-error - role not typed on session
    const role = session.user.role;
    const isSelf = session.user.id === id;
    if (!isSelf && !['MANAGEMENT', 'HR', 'BRANCH_MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isSelf && role === 'BRANCH_MANAGER') {
      const [target, manager] = await Promise.all([
        prisma.user.findUnique({ where: { id }, select: { branchId: true } }),
        prisma.user.findUnique({ where: { id: session.user!.id as string }, select: { managedBranchId: true, branchId: true } }),
      ]);
      const managerBranchId = manager?.managedBranchId ?? manager?.branchId;
      if (!managerBranchId || managerBranchId !== target?.branchId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const documents = await prisma.userDocument.findMany({
      where: { userId: id },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        documentType: { select: { id: true, name: true, mandatory: true, scope: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error fetching user documents:", error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

