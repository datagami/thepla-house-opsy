import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await auth().signOut();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to sign out" },
      { status: 500 }
    );
  }
} 
