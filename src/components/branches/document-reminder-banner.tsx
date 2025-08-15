"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Calendar, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BranchDocument } from "@/models/models";

interface DocumentReminderBannerProps {
  branchId: string;
}

export function DocumentReminderBanner({ branchId }: DocumentReminderBannerProps) {
  const [urgentDocuments, setUrgentDocuments] = useState<BranchDocument[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    fetchUrgentDocuments();
  }, [branchId]);

  const fetchUrgentDocuments = async () => {
    try {
      const response = await fetch(`/api/branches/${branchId}/documents`);
      if (!response.ok) return;
      
      const documents: BranchDocument[] = await response.json();
      const now = new Date();
      
      // Filter documents that need attention (reminder date is within 7 days or overdue)
      const urgent = documents.filter(doc => {
        const reminderDate = new Date(doc.reminderDate);
        const diffTime = reminderDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      });
      
      setUrgentDocuments(urgent);
    } catch (error) {
      console.error("Error fetching urgent documents:", error);
    }
  };

  if (!isVisible || urgentDocuments.length === 0) {
    return null;
  }

  const getReminderText = (document: BranchDocument) => {
    const now = new Date();
    const reminderDate = new Date(document.reminderDate);
    const diffTime = reminderDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} days`;
    } else if (diffDays === 0) {
      return "Due today";
    } else if (diffDays === 1) {
      return "Due tomorrow";
    } else {
      return `Due in ${diffDays} days`;
    }
  };

  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-800">Document Reminders</AlertTitle>
      <AlertDescription className="text-orange-700">
        <div className="space-y-2">
          {urgentDocuments.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">{doc.name}</span>
                <span className="text-sm">
                  {getReminderText(doc)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/branches/${branchId}/documents`, '_blank')}
            className="border-orange-300 text-orange-700 hover:bg-orange-100"
          >
            View Documents
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="text-orange-600 hover:bg-orange-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
} 