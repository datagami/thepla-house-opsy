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

  async uploadImage(file: Buffer, fileName: string, folder: string): Promise<string> {
    const blobClient = await this.getBlobClient(fileName, folder);
    await blobClient.uploadData(file, {
      blobHTTPHeaders: { blobContentType: 'image/jpeg' }
    });
    return blobClient.url;
  }

  async deleteImage(fileName: string, folder: string): Promise<void> {
    const blobClient = await this.getBlobClient(fileName, folder);
    await blobClient.deleteIfExists();
  }

  // Generate a SAS URL for temporary access
  async generateSasUrl(fileName: string, folder: string, expiresInHours: number = 1): Promise<string> {
    const blobClient = await this.getBlobClient(fileName, folder);
    const sasOptions = {
      permissions: BlobSASPermissions.parse('r'), // Read only
      expiresOn: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      protocol: SASProtocol.Https,
      cacheControl: 'no-cache',
      contentDisposition: 'inline',
      contentType: 'image/jpeg'
    };
    
    return await blobClient.generateSasUrl(sasOptions);
  }
} 
