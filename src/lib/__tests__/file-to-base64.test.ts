import { describe, it, expect } from "vitest";
import { fileToBase64 } from "@/lib/file-to-base64";
describe("fileToBase64", () => {
  // FileReader is a browser API not available in the node test environment;
  // covered by manual browser verification.
  it.skip("reads a File into a data URL with its content type", async () => {
    const file = new File([Uint8Array.from([0x41])], "a.txt", { type: "text/plain" });
    const res = await fileToBase64(file);
    expect(res.contentType).toBe("text/plain");
    expect(res.base64.startsWith("data:")).toBe(true);
  });
});
