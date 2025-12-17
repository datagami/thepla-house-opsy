import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hash } from "bcrypt";
import { hasAccess } from "@/lib/access-control";
import { logTargetUserActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";
import { generatePassword } from "@/lib/utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // @ts-expect-error - role is not defined in the session type
    const canManageUsers = hasAccess(session.user.role, "users.manage");
    if (!canManageUsers) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate new password: first 3 letters of name + @ + 4 random digits
    const newPassword = generatePassword(user.name);
    const hashedPassword = await hash(newPassword, 12);

    // Update user password
    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
      },
    });

    // Log password reset
    const sessionUserId = (session.user as { id?: string }).id;
    if (sessionUserId) {
      await logTargetUserActivity(
        ActivityType.PASSWORD_CHANGED,
        sessionUserId,
        user.id,
        `Password reset for user: ${user.name} (${user.email})`,
        {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
        },
        request
      );
    }

    // Return new password (one-time view)
    return NextResponse.json({
      success: true,
      password: newPassword, // Return plain password for one-time viewing
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
