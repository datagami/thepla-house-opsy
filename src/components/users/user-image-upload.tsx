'use client';

import {useState, useRef} from 'react';
import {useSession} from 'next-auth/react';
import {Button} from '@/components/ui/button';
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar';
import {Dialog, DialogContent, DialogTitle} from '@/components/ui/dialog';
import {Camera, Loader2} from 'lucide-react';
import {toast} from 'sonner';
import {getInitials} from '@/lib/utils';

interface UserImageUploadProps {
  userId: string;
  currentImage?: string | null;
  onImageUpdate?: (imageUrl: string) => void;
  userName?: string | null;
}

export function UserImageUpload({userId, currentImage, onImageUpdate, userName}: UserImageUploadProps) {
  const {update: updateSession} = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage || null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('File must be an image');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/users/${userId}/image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      const data = await response.json();
      onImageUpdate?.(data.imageUrl);
      await updateSession();
      toast.success('Profile image updated successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
      // Revert preview on error
      setPreviewUrl(currentImage || null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarClick = () => {
    if (previewUrl) setIsViewerOpen(true);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`relative rounded-full transition-all duration-150 ${dragActive ? 'ring-2 ring-primary ring-offset-2' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
      >
        <button
          type="button"
          onClick={handleAvatarClick}
          disabled={!previewUrl}
          className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default"
          aria-label={previewUrl ? "View profile image" : "No profile image"}
        >
          <Avatar className="h-32 w-32">
            <AvatarImage src={previewUrl || ''} alt="Profile image"/>
            <AvatarFallback>
              {currentImage ? '...' : getInitials(userName)}
            </AvatarFallback>
          </Avatar>
        </button>
        {dragActive && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-primary/20 pointer-events-none">
            <span className="text-xs font-medium text-primary">Drop</span>
          </div>
        )}
        <Button
          size="icon"
          variant="secondary"
          className="absolute bottom-0 right-0 rounded-full"
          onClick={handleButtonClick}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin"/>
          ) : (
            <Camera className="h-4 w-4"/>
          )}
        </Button>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
        disabled={isUploading}
      />
      <p className="text-sm text-muted-foreground">
        Click the camera or drag a photo here · JPG/PNG/GIF, max 5MB
      </p>

      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="max-w-3xl p-2 bg-black/90 border-0 [&>button]:text-white [&>button]:bg-white/10 [&>button]:hover:bg-white/20 [&>button]:rounded-full [&>button]:p-1 [&>button]:opacity-100">
          <DialogTitle className="sr-only">Profile image</DialogTitle>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Profile image"
              className="w-full h-auto max-h-[80vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 
