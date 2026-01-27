import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET: Return all active warning types (for dropdown)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const warningTypes = await prisma.warningType.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(warningTypes);
  } catch (error) {
    console.error("Error fetching warning types:", error);
    return NextResponse.json(
      { error: "Failed to fetch warning types" },
      { status: 500 }
    );
  }
}

// POST: Create new warning type (HR/MANAGEMENT only)
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // @ts-expect-error - role is not in the User type
    const role = session.user.role;
    if (!["HR", "MANAGEMENT"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Warning type name is required" },
        { status: 400 }
      );
    }

    // Check if warning type already exists
    const existing = await prisma.warningType.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Warning type already exists" },
        { status: 409 }
      );
    }

    const warningType = await prisma.warningType.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isActive: true,
      },
    });

    return NextResponse.json(warningType, { status: 201 });
  } catch (error) {
    console.error("Error creating warning type:", error);
    return NextResponse.json(
      { error: "Failed to create warning type" },
      { status: 500 }
    );
  }
}

// PUT: Update warning type (HR/MANAGEMENT only)
export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // @ts-expect-error - role is not in the User type
    const role = session.user.role;
    if (!["HR", "MANAGEMENT"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, description, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Warning type ID is required" },
        { status: 400 }
      );
    }

    // Check if warning type exists
    const existing = await prisma.warningType.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Warning type not found" },
        { status: 404 }
      );
    }

    // If name is being changed, check for conflicts
    if (name && name.trim() !== existing.name) {
      const nameConflict = await prisma.warningType.findUnique({
        where: { name: name.trim() },
      });

      if (nameConflict) {
        return NextResponse.json(
          { error: "Warning type name already exists" },
          { status: 409 }
        );
      }
    }

    const warningType = await prisma.warningType.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(warningType);
  } catch (error) {
    console.error("Error updating warning type:", error);
    return NextResponse.json(
      { error: "Failed to update warning type" },
      { status: 500 }
    );
  }
}

// DELETE: Delete warning type if not in use (HR/MANAGEMENT only)
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // @ts-expect-error - role is not in the User type
    const role = session.user.role;
    if (!["HR", "MANAGEMENT"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Warning type ID is required" },
        { status: 400 }
      );
    }

    // Check if warning type exists
    const existing = await prisma.warningType.findUnique({
      where: { id },
      include: {
        warnings: {
          select: { id: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Warning type not found" },
        { status: 404 }
      );
    }

    // Check if warning type is in use
    if (existing.warnings.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete warning type that is assigned to warnings",
          warningCount: existing.warnings.length,
        },
        { status: 409 }
      );
    }

    // Hard delete - actually remove from database
    await prisma.warningType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Warning type deleted successfully" });
  } catch (error) {
    console.error("Error deleting warning type:", error);
    return NextResponse.json(
      { error: "Failed to delete warning type" },
      { status: 500 }
    );
  }
}
