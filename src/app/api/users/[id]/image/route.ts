import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AzureStorageService } from "@/lib/azure-storage";

const PROFILE_PICTURES_FOLDER = 'profile-pictures';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const {id} = await params;
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is updating their own profile or has permission
    // @ts-expect-error - role is not in session type
    const isAdmin = ['HR', 'MANAGEMENT'].includes(session.user.role);
    const isOwnProfile = session.user.id === id;

    if (!isAdmin && !isOwnProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // Get current user image to delete later
    const currentUser = await prisma.user.findUnique({
      where: { id },
      select: { image: true }
    });

    // Upload to Azure
    const buffer = Buffer.from(await file.arrayBuffer());
    const azureStorage = new AzureStorageService();
    const filename = `${id}-${Date.now()}-${file.name}`;
    const imageUrl = await azureStorage.uploadImage(buffer, filename, PROFILE_PICTURES_FOLDER);

    // Update user's image field in database
    await prisma.user.update({
      where: { id },
      data: { image: imageUrl }
    });

    // Delete old image if exists
    if (currentUser?.image) {
      try {
        const oldFilename = currentUser.image.split('/').pop();
        if (oldFilename) {
          await azureStorage.deleteImage(oldFilename, PROFILE_PICTURES_FOLDER);
        }
      } catch (error) {
        console.error("Error deleting old image:", error);
        // Don't fail the request if old image deletion fails
      }
    }

    return NextResponse.json({
      message: "Image uploaded successfully",
      imageUrl
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json(
      { error: "Error uploading image" },
      { status: 500 }
    );
  }
} 
