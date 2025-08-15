"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  MoreHorizontal, 
  Download, 
  Trash, 
  FileText, 
  Image, 
  Archive,
  AlertTriangle,
  Calendar
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { BranchDocument } from "@/models/models";

interface BranchDocumentsListProps {
  branchId: string;
  canUpload?: boolean;
}

export function BranchDocumentsList({ branchId, canUpload = false }: BranchDocumentsListProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<BranchDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<BranchDocument | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [branchId]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/branches/${branchId}/documents`);
      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to fetch documents");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (document: BranchDocument) => {
    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;

    setIsDeleting(documentToDelete.id);
    try {
      const response = await fetch(`/api/branches/${branchId}/documents/${documentToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      toast.success("Document deleted successfully");
      fetchDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    } finally {
      setIsDeleting(null);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const handleDownload = (document: BranchDocument) => {
    // Open the download URL in a new tab
    window.open(`/api/branches/${branchId}/documents/${document.id}/download`, '_blank');
  };



  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    } else if (fileType === 'application/pdf') {
      return <FileText className="h-4 w-4" />;
    } else if (fileType.includes('zip')) {
      return <Archive className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getReminderStatus = (reminderDate: Date) => {
    const now = new Date();
    const reminder = new Date(reminderDate);
    const diffTime = reminder.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { status: 'overdue', text: 'Overdue', color: 'destructive' as const };
    } else if (diffDays <= 7) {
      return { status: 'urgent', text: `${diffDays} days left`, color: 'destructive' as const };
    } else if (diffDays <= 30) {
      return { status: 'warning', text: `${diffDays} days left`, color: 'secondary' as const };
    } else {
      return { status: 'ok', text: `${diffDays} days left`, color: 'default' as const };
    }
  };

  const getRenewalStatus = (renewalDate: Date) => {
    const now = new Date();
    const renewal = new Date(renewalDate);
    const diffTime = renewal.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { status: 'expired', text: 'Expired', color: 'destructive' as const };
    } else if (diffDays <= 30) {
      return { status: 'expiring', text: `${diffDays} days left`, color: 'secondary' as const };
    } else {
      return { status: 'valid', text: `${diffDays} days left`, color: 'default' as const };
    }
  };

  if (isLoading) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>Branch Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">Loading documents...</div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Branch Documents
            {documents.length > 0 && (
              <Badge variant="secondary">{documents.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No documents uploaded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Renewal Date</TableHead>
                  <TableHead>Reminder Date</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => {
                  const reminderStatus = getReminderStatus(document.reminderDate);
                  const renewalStatus = getRenewalStatus(document.renewalDate);

                  return (
                    <TableRow key={document.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getFileIcon(document.fileType)}
                          <div>
                            <div className="font-medium">{document.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {document.fileName}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {document.description || (
                          <span className="text-muted-foreground">No description</span>
                        )}
                      </TableCell>
                      <TableCell>{formatFileSize(document.fileSize)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <div>
                            <div className="text-sm">
                              {new Date(document.renewalDate).toLocaleDateString()}
                            </div>
                            <Badge variant={renewalStatus.color}>
                              {renewalStatus.text}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          <div>
                            <div className="text-sm">
                              {new Date(document.reminderDate).toLocaleDateString()}
                            </div>
                            <Badge variant={reminderStatus.color}>
                              {reminderStatus.text}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{document.uploadedBy.name}</div>
                          <div className="text-muted-foreground">
                            {new Date(document.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => handleDownload(document)}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </DropdownMenuItem>
                            {canUpload && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(document)}
                                disabled={isDeleting === document.id}
                                className="text-red-600"
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                {isDeleting === document.id ? "Deleting..." : "Delete"}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{documentToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDocumentToDelete(null);
              }}
              disabled={isDeleting === documentToDelete?.id}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting === documentToDelete?.id}
            >
              {isDeleting === documentToDelete?.id ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 