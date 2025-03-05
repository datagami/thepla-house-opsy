import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hash } from "bcrypt";
import { hasAccess } from "@/lib/access-control";
import { User } from "@prisma/client";

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
    const { 
      name, 
      email, 
      role, 
      branchId, 
      password,
      title,
      department,
      mobileNo,
      doj,
      dob,
      gender,
      panNo,
      aadharNo,
      salary,
      references 
    } = body;

    // Base update data that any user can modify
    const updateData: Partial<User> = {
      name,
      email,
      title,
      mobileNo,
      dob: dob ? new Date(dob) : undefined,
      gender,
      panNo,
      aadharNo,
      updatedAt: new Date(),
    };

    // Additional fields that only managers can modify
    if (canManageUsers) {
      Object.assign(updateData, {
        role,
        branchId,
        department,
        doj: doj ? new Date(doj) : undefined,
        salary: parseFloat(salary),
      });
    }

    if (password) {
      updateData.password = await hash(password, 10);
    }

    // Update user and references in a transaction
    const user = await prisma.$transaction(async (tx) => {
      // Update user
      const updatedUser = await tx.user.update({
        where: { id },
        data: updateData,
        include: {
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
          references: true,
        },
      });

      // Update references if provided and user has permission
      if (references && (canManageUsers || isOwnProfile)) {
        // Delete existing references
        await tx.reference.deleteMany({
          where: { userId: id },
        });

        // Create new references
        await tx.reference.createMany({
          data: references.map((ref: { name: string; contactNo: string }) => ({
            name: ref.name,
            contactNo: ref.contactNo,
            userId: id,
          })),
        });
      }

      return updatedUser;
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
