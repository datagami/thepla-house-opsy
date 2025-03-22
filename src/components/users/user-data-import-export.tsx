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

export interface ExcelObject {
  "Name*": string;
  "Email*": string;
  "Mobile No*": string;
  "Gender*": string;
  "Department*": string;
  "Title*": string;
  "Role*": string;
  "Branch*"?: string;
  "DOB*": string;
  "DOJ*": string;
  "Salary*": string | number; // Handle both string and number
  "PAN No*": string;
  "Aadhar No*": string;
  "Bank Account No*": string;
  "Bank IFSC Code*": string;
  "Reference 1 Name*": string;
  "Reference 1 Contact*": string;
  "Reference 2 Name"?: string;
  "Reference 2 Contact"?: string;
}


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
      const userData = users.map((user: User) => ({
        'Name*': user.name,
        'Email*': user.email,
        'Mobile No*': user.mobileNo,
        'Gender*': user.gender,
        'Department*': user.department,
        'Title*': user.title,
        'Role*': user.role,
        'Branch*': user.branch?.name || '',
        // Format dates with single quotes to prevent Excel conversion
        'DOB*': user.dob ? `'${new Date(user.dob).toLocaleDateString('en-GB')}` : '',
        'DOJ*': user.doj ? `'${new Date(user.doj).toLocaleDateString('en-GB')}` : '',
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

      // Set column width and format
      const columnWidths = [
        { wch: 20 }, // Name
        { wch: 25 }, // Email
        { wch: 15 }, // Mobile
        { wch: 10 }, // Gender
        { wch: 15 }, // Department
        { wch: 10 }, // Title
        { wch: 10 }, // Role
        { wch: 15 }, // Branch
        { wch: 12 }, // DOB
        { wch: 12 }, // DOJ
        { wch: 10 }, // Salary
        { wch: 12 }, // PAN
        { wch: 15 }, // Aadhar
        { wch: 20 }, // Bank Account
        { wch: 15 }, // IFSC
        { wch: 20 }, // Ref1 Name
        { wch: 15 }, // Ref1 Contact
        { wch: 20 }, // Ref2 Name
        { wch: 15 }, // Ref2 Contact
      ];

      sheet['!cols'] = columnWidths;

      XLSX.utils.book_append_sheet(workbook, sheet, 'Users');
      XLSX.writeFile(workbook, 'users-data.xlsx');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export users data');
    }
  };


  const validateUserData = (userData: ExcelObject) => {
    const errors: string[] = [];
    const requiredFields = [
      'Name*', 'Email*', 'Mobile No*', 'Gender*', 'Department*',
      'Title*', 'Role*', 'DOB*', 'DOJ*', 'Salary*',
      'PAN No*', 'Aadhar No*', 'Bank Account No*', 'Bank IFSC Code*',
      'Reference 1 Name*', 'Reference 1 Contact*'
    ] as const;

    // Check required fields
    requiredFields.forEach(field => {
      if (!userData[field as keyof ExcelObject]) {
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

          // Configure date parsing
          const jsonData = XLSX.utils.sheet_to_json<ExcelObject>(sheet, {
            raw: false, // Don't convert values
            dateNF: 'dd/mm/yyyy', // Set date format
          });

          // Process the data before validation
          const processedData = jsonData.map(row => ({
            ...row,
            // Remove any leading single quotes from dates (if present from export)
            'DOB*': row['DOB*']?.replace(/^'/, ''),
            'DOJ*': row['DOJ*']?.replace(/^'/, ''),
            // Convert number values to strings where needed
            'Mobile No*': row['Mobile No*']?.toString(),
            'Aadhar No*': row['Aadhar No*']?.toString(),
            'Bank Account No*': row['Bank Account No*']?.toString(),
            'Reference 1 Contact*': row['Reference 1 Contact*']?.toString(),
            'Reference 2 Contact': row['Reference 2 Contact']?.toString(),
          }));

          // Validate all rows
          const allErrors: string[] = [];
          processedData.forEach((row: ExcelObject, index: number) => {
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
            body: JSON.stringify({ users: processedData }),
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
