"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface JoiningFormAlertProps {
  userId: string;
}

export function JoiningFormAlert({ userId }: JoiningFormAlertProps) {
  const handleSignForm = () => {
    window.open(`/users/${userId}/joining-form-signature`, '_blank');
  };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
        </div>
        <div className="flex-1">
                        <h3 className="text-sm font-medium text-orange-800">
                Complete Your Onboarding
              </h3>
              <p className="text-sm text-orange-700 mt-1">
                Please sign your appointment letter to complete the onboarding process and access all features.
              </p>
        </div>
        <div className="flex-shrink-0">
          <Button
            size="sm"
            onClick={handleSignForm}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
                            Sign Letter
          </Button>
        </div>
      </div>
    </div>
  );
} 