import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; advanceId: string }> }
) {
  try {
    const session = await auth();
    const { id, advanceId } = await params;

    // @ts-expect-error role expected
    if (!session?.user || !["HR", "MANAGEMENT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if advance payment exists and belongs to the user
    const advancePayment = await prisma.advancePayment.findUnique({
      where: {
        id: advanceId,
        userId: id,
      },
      include: {
        installments: true
      }
    });

    if (!advancePayment) {
      return NextResponse.json({ error: "Advance payment not found" }, { status: 404 });
    }

    // Check if there are any approved or paid installments
    const hasInstallments = advancePayment.installments.some(
      installment => ["APPROVED", "PAID"].includes(installment.status)
    );

    if (hasInstallments) {
      return NextResponse.json(
        { error: "Cannot delete advance payment with approved or paid installments" },
        { status: 400 }
      );
    }

    // Delete the advance payment and its pending installments in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete any pending installments first
      await tx.advancePaymentInstallment.deleteMany({
        where: {
          advanceId,
          status: "PENDING"
        }
      });

      // Delete the advance payment
      await tx.advancePayment.delete({
        where: {
          id: advanceId
        }
      });

      // Update user's total advance balance
      await tx.user.update({
        where: { id },
        data: {
          totalAdvanceBalance: {
            decrement: advancePayment.amount
          }
        }
      });
    });

    return NextResponse.json({ success: true, message: "Advance payment deleted successfully" });
  } catch (error) {
    console.error("Error deleting advance payment:", error);
    return NextResponse.json(
      { error: "Failed to delete advance payment" },
      { status: 500 }
    );
  }
} 