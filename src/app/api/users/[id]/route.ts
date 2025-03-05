import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hash } from "bcrypt";
import { hasAccess } from "@/lib/access-control";
import {User} from "@prisma/client";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // @ts-expect-error - role is not defined in the session type
    const canManageUsers = hasAccess(session.user.role, "users.manage");
    const isOwnProfile = session.user.id === id;

    if (!canManageUsers && !isOwnProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, role, branchId, password } = body;

    // Only allow role and branch changes if user has management permissions

    const updateData: User = {
      name,
      email,
      updatedAt: new Date(),
    } as User;

    if (canManageUsers) {
      updateData.role = role;
      updateData.branchId = branchId;
    }

    if (password) {
      updateData.password = await hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: id },
      data: updateData as User,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Error updating user" },
      { status: 500 }
    );
  }
} 
