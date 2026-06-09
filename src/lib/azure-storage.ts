import { BlobServiceClient, BlockBlobClient, BlobSASPermissions, SASProtocol } from '@azure/storage-blob';

export class AzureStorageService {
  private blobServiceClient: BlobServiceClient;
  private containerName: string;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }

  private async getBlobClient(fileName: string, folder: string): Promise<BlockBlobClient> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    await containerClient.createIfNotExists();
    const blobName = `${folder}/${fileName}`;
    return containerClient.getBlockBlobClient(blobName);
  }

  async uploadImage(file: Buffer, fileName: string, folder: string, contentType?: string): Promise<string> {
    const blobClient = await this.getBlobClient(fileName, folder);
    await blobClient.uploadData(file, {
      blobHTTPHeaders: { blobContentType: contentType || 'image/jpeg' }
    });
    return blobClient.url;
  }

  async uploadBase64Image(base64Data: string, fileName: string, folder: string, contentType?: string): Promise<string> {
    // Remove data URL prefix if present
    const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64String, 'base64');
    
    // Upload to Azure
    return await this.uploadImage(buffer, fileName, folder, contentType || 'image/jpeg');
  }

  async deleteImage(fileName: string, folder: string): Promise<void> {
    const blobClient = await this.getBlobClient(fileName, folder);
    await blobClient.deleteIfExists();
  }

  async deleteByUrl(blobUrl: string): Promise<void> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const prefix = `/${this.containerName}/`;
      const pathName = new URL(blobUrl).pathname;
      const idx = pathName.indexOf(prefix);
      if (idx === -1) return;
      const blobName = decodeURIComponent(pathName.slice(idx + prefix.length));
      await containerClient.getBlockBlobClient(blobName).deleteIfExists();
    } catch (e) {
      console.error("Failed to delete blob by URL:", blobUrl, e);
    }
  }

  async downloadByUrl(blobUrl: string): Promise<{ buffer: Buffer; blobName: string } | null> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const prefix = `/${this.containerName}/`;
      const pathName = new URL(blobUrl).pathname;
      const idx = pathName.indexOf(prefix);
      if (idx === -1) return null;
      const blobName = decodeURIComponent(pathName.slice(idx + prefix.length));
      const buffer = await containerClient.getBlockBlobClient(blobName).downloadToBuffer();
      return { buffer, blobName };
    } catch (e) {
      console.error("Failed to download blob by URL:", blobUrl, e);
      return null;
    }
  }

  // Generate a SAS URL for temporary access
  async generateSasUrl(fileName: string, folder: string, expiresInHours: number = 1, contentType?: string): Promise<string> {
    const blobClient = await this.getBlobClient(fileName, folder);
    const sasOptions = {
      permissions: BlobSASPermissions.parse('r'), // Read only
      expiresOn: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      protocol: SASProtocol.Https,
      cacheControl: 'no-cache',
      contentDisposition: 'attachment',
      contentType: contentType || 'application/octet-stream'
    };
    
    return await blobClient.generateSasUrl(sasOptions);
  }
} 
