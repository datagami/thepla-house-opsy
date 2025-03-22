"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {User} from "@/models/models";

interface UserDataImportExportProps {
  onImportComplete?: () => void;
}

export function UserDataImportExport({ onImportComplete }: UserDataImportExportProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleDownload = async () => {
    try {
      const response = await fetch('/api/users/export');
      if (!response.ok) throw new Error('Export failed');
      
      const users = await response.json();

      // Format data for Excel with date formatting
      const userData = users.map(user => ({
        'Name*': user.name,
        'Email*': user.email,
        'Mobile No*': user.mobileNo,
        'Gender*': user.gender,
        'Department*': user.department,
        'Title*': user.title,
        'Role*': user.role,
        'Branch*': user.branch?.name || '',
        // Format dates as DD-MM-YYYY
        'DOB*': new Date(user.dob).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }),
        'DOJ*': new Date(user.doj).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }),
        'Salary*': user.salary,
        'PAN No*': user.panNo,
        'Aadhar No*': user.aadharNo,
        'Bank Account No*': user.bankAccountNo,
        'Bank IFSC Code*': user.bankIfscCode,
        // References
        'Reference 1 Name*': user.references?.[0]?.name || '',
        'Reference 1 Contact*': user.references?.[0]?.contactNo || '',
        'Reference 2 Name': user.references?.[1]?.name || '',
        'Reference 2 Contact': user.references?.[1]?.contactNo || '',
      }));

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(userData);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Users');
      XLSX.writeFile(workbook, 'users-data.xlsx');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export users data');
    }
  };


  const validateUserData = (userData: any) => {
    const errors: string[] = [];
    const requiredFields = [
      'Name*', 'Email*', 'Mobile No*', 'Gender*', 'Department*', 
      'Title*', 'Role*', 'DOB*', 'DOJ*', 'Salary*',
      'PAN No*', 'Aadhar No*', 'Bank Account No*', 'Bank IFSC Code*',
      'Reference 1 Name*', 'Reference 1 Contact*'
    ];

    // Check required fields
    requiredFields.forEach(field => {
      if (!userData[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Branch is required only for EMPLOYEE role
    if (userData['Role*'] === 'EMPLOYEE' && !userData['Branch*']) {
      errors.push('Branch is required for EMPLOYEE role');
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData['Email*'])) {
      errors.push('Invalid email format');
    }

    // Validate mobile numbers
    if (!/^\d{10}$/.test(userData['Mobile No*'])) {
      errors.push('Mobile number must be 10 digits');
    }

    // Validate reference contacts
    if (!/^\d{10}$/.test(userData['Reference 1 Contact*'])) {
      errors.push('Reference 1 contact must be 10 digits');
    }
    if (userData['Reference 2 Contact'] && !/^\d{10}$/.test(userData['Reference 2 Contact'])) {
      errors.push('Reference 2 contact must be 10 digits');
    }
    if (userData['Reference 3 Contact'] && !/^\d{10}$/.test(userData['Reference 3 Contact'])) {
      errors.push('Reference 3 contact must be 10 digits');
    }

    // Other validations...
    return errors;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      setValidationErrors([]);
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet);

          // Validate all rows
          const allErrors: string[] = [];
          jsonData.forEach((row: any, index: number) => {
            const rowErrors = validateUserData(row);
            if (rowErrors.length > 0) {
              allErrors.push(`Row ${index + 2}: ${rowErrors.join(', ')}`);
            }
          });

          if (allErrors.length > 0) {
            setValidationErrors(allErrors);
            return;
          }

          // Upload data if validation passes
          const response = await fetch('/api/users/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ users: jsonData }),
          });

          if (!response.ok) throw new Error('Import failed');

          toast.success('Users imported successfully');
          setShowUploadDialog(false);
          onImportComplete?.();
        } catch (error) {
          console.error('Import failed:', error);
          toast.error('Failed to import users');
        }
      };
      reader.readAsArrayBuffer(file);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Button onClick={handleDownload} variant="outline">
        <Download className="h-4 w-4 mr-2" />
        Download Template & Data
      </Button>
      <Button onClick={() => setShowUploadDialog(true)} variant="outline">
        <Upload className="h-4 w-4 mr-2" />
        Upload Users
      </Button>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Users Data</DialogTitle>
            <DialogDescription>
              Upload an Excel file with user data. Download the template first to see the required format.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Validation Errors</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 mt-2">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUpload}
                disabled={isUploading}
              />
              <p className="text-sm text-muted-foreground">
                Only Excel files (.xlsx, .xls) are supported
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
