import { AzureStorageService } from './azure-storage';

export interface UploadResult {
  signatureUrl: string;
  photoUrl: string;
}

export async function uploadJoiningFormFiles(
  signature: string, 
  photo: string, 
  userId: string
): Promise<UploadResult> {
  const azureStorage = new AzureStorageService();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  try {
    // Upload signature
    const signatureFileName = `signature-${userId}-${timestamp}.png`;
    const signatureUrl = await azureStorage.uploadBase64Image(
      signature, 
      signatureFileName, 
      'joining-forms/signatures', 
      'image/png'
    );
    
    // Upload photo
    const photoFileName = `photo-${userId}-${timestamp}.jpg`;
    const photoUrl = await azureStorage.uploadBase64Image(
      photo, 
      photoFileName, 
      'joining-forms/photos', 
      'image/jpeg'
    );
    
    console.log('Files uploaded to Azure:', { signatureUrl, photoUrl });
    
    return { signatureUrl, photoUrl };
  } catch (error) {
    console.error('Error uploading to Azure:', error);
    throw new Error('Failed to upload files to storage');
  }
} 