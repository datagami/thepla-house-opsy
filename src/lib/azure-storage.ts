import { BlobServiceClient, BlockBlobClient, BlobSASPermissions, SASProtocol } from '@azure/storage-blob';

export class AzureStorageService {
  private blobServiceClient: BlobServiceClient;
  private containerName: string;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;
    console.log(connectionString, this.containerName);
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
