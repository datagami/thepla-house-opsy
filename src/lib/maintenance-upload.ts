import { AzureStorageService } from "./azure-storage";

export interface UploadFile {
  base64: string;
  contentType: string;
}

export interface MaintenanceUploadInput {
  bill?: UploadFile | null;
  photos?: UploadFile[];
}

export interface MaintenanceUploadResult {
  billUrl: string | null;
  photoUrls: string[];
}

const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function extFor(contentType: string): string {
  return EXT_BY_TYPE[contentType] ?? "bin";
}

function decodeBase64(data: string): Buffer {
  const stripped = data.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(stripped, "base64");
}

/**
 * Uploads a bill and/or service photos to Azure Blob and returns their URLs.
 * Only the returned URL strings are persisted in the DB (the files live in Blob).
 * Folders: equipment/{branchId}/bills, equipment/{branchId}/photos.
 */
export async function uploadMaintenanceFiles(
  input: MaintenanceUploadInput,
  equipmentId: string,
  branchId: string
): Promise<MaintenanceUploadResult> {
  const azure = new AzureStorageService();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  let billUrl: string | null = null;
  if (input.bill) {
    const fileName = `bill-${equipmentId}-${stamp}.${extFor(input.bill.contentType)}`;
    billUrl = await azure.uploadImage(
      decodeBase64(input.bill.base64),
      fileName,
      `equipment/${branchId}/bills`,
      input.bill.contentType
    );
  }

  const photoUrls: string[] = [];
  const photos = input.photos ?? [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const fileName = `photo-${equipmentId}-${stamp}-${i}.${extFor(p.contentType)}`;
    const url = await azure.uploadImage(
      decodeBase64(p.base64),
      fileName,
      `equipment/${branchId}/photos`,
      p.contentType
    );
    photoUrls.push(url);
  }

  return { billUrl, photoUrls };
}

/**
 * Best-effort deletion of previously-uploaded maintenance blobs by URL.
 * Used to clean up orphaned files when a subsequent DB write fails.
 */
export async function deleteMaintenanceFiles(
  urls: Array<string | null | undefined>
): Promise<void> {
  const azure = new AzureStorageService();
  await Promise.all(
    urls.filter((u): u is string => !!u).map((u) => azure.deleteByUrl(u))
  );
}
