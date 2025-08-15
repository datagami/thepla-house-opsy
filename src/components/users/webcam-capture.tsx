"use client";

import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface WebcamCaptureProps {
  onPhotoCapture: (photoData: string) => void;
  onClose: () => void;
}

export function WebcamCapture({ onPhotoCapture, onClose }: WebcamCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: facingMode,
  };

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImage(imageSrc);
        toast.success('Photo captured successfully!');
      } else {
        toast.error('Failed to capture photo. Please try again.');
      }
    }
  }, [webcamRef]);

  const retake = () => {
    setCapturedImage(null);
  };

  const confirmPhoto = () => {
    if (capturedImage) {
      onPhotoCapture(capturedImage);
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Identity Verification Photo
          </h3>
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {!capturedImage ? (
            <>
              <div className="relative">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  className="w-full max-w-md mx-auto border rounded-lg"
                />
                <Button
                  onClick={switchCamera}
                  variant="outline"
                  size="sm"
                  className="absolute top-2 left-2"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-center">
                <Button onClick={capture} className="bg-green-600 hover:bg-green-700">
                  <Camera className="h-4 w-4 mr-2" />
                  Capture Photo
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="relative inline-block">
                  <img
                    src={capturedImage}
                    alt="Captured photo"
                    className="w-full max-w-md mx-auto border-2 border-green-300 rounded-lg shadow-lg"
                  />
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                    <span className="text-xs">✓</span>
                  </div>
                </div>
                <p className="text-sm text-green-600 mt-2 font-medium">
                  ✓ Photo captured successfully
                </p>
              </div>
              <div className="text-center space-x-2">
                <Button onClick={retake} variant="outline">
                  <Camera className="h-4 w-4 mr-2" />
                  Retake Photo
                </Button>
                <Button onClick={confirmPhoto} className="bg-blue-600 hover:bg-blue-700">
                  Use This Photo
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 