import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET: Return all active departments (for dropdown)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const departments = await prisma.department.findMany({
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

    return NextResponse.json(departments);
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json(
      { error: "Failed to fetch departments" },
      { status: 500 }
    );
  }
}

// POST: Create new department (HR/MANAGEMENT only)
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
        { error: "Department name is required" },
        { status: 400 }
      );
    }

    // Check if department already exists
    const existing = await prisma.department.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Department already exists" },
        { status: 409 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isActive: true,
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    console.error("Error creating department:", error);
    return NextResponse.json(
      { error: "Failed to create department" },
      { status: 500 }
    );
  }
}

// PUT: Update department (HR/MANAGEMENT only)
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
        { error: "Department ID is required" },
        { status: 400 }
      );
    }

    // Check if department exists
    const existing = await prisma.department.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    // If name is being changed, check for conflicts
    if (name && name.trim() !== existing.name) {
      const nameConflict = await prisma.department.findUnique({
        where: { name: name.trim() },
      });

      if (nameConflict) {
        return NextResponse.json(
          { error: "Department name already exists" },
          { status: 409 }
        );
      }
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(department);
  } catch (error) {
    console.error("Error updating department:", error);
    return NextResponse.json(
      { error: "Failed to update department" },
      { status: 500 }
    );
  }
}

// DELETE: Soft delete department (set isActive=false) (HR/MANAGEMENT only)
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
        { error: "Department ID is required" },
        { status: 400 }
      );
    }

    // Check if department exists
    const existing = await prisma.department.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    // Check if department is in use
    if (existing.users.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete department that is assigned to users",
          userCount: existing.users.length,
        },
        { status: 409 }
      );
    }

    // Soft delete by setting isActive to false
    const department = await prisma.department.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(department);
  } catch (error) {
    console.error("Error deleting department:", error);
    return NextResponse.json(
      { error: "Failed to delete department" },
      { status: 500 }
    );
  }
}

