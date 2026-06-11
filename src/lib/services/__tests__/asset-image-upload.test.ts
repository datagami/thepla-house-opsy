import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadAssetImage } from "@/lib/maintenance-upload";

const uploadImage = vi.fn();
vi.mock("@/lib/azure-storage", () => ({
  AzureStorageService: class {
    uploadImage = uploadImage;
  },
}));

beforeEach(() => {
  uploadImage.mockReset();
  uploadImage.mockImplementation(async (_buf, fileName: string, folder: string) => `https://blob.test/${folder}/${fileName}`);
});

describe("uploadAssetImage", () => {
  it("returns null for no image", async () => {
    expect(await uploadAssetImage(null, "eq-1", "b-1")).toBeNull();
    expect(uploadImage).not.toHaveBeenCalled();
  });
  it("uploads to the asset-images folder and returns the url", async () => {
    const url = await uploadAssetImage({ base64: "data:image/jpeg;base64,QQ==", contentType: "image/jpeg" }, "eq-1", "b-1");
    expect(url).toContain("equipment/b-1/asset-images/");
    expect(url).toMatch(/\.jpg$/);
    expect(Buffer.isBuffer(uploadImage.mock.calls[0][0])).toBe(true);
  });
});
