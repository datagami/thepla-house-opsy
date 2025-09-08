"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Edit } from "lucide-react";

interface Uniform {
  id: string;
  itemName: string;
  itemType: string;
  size?: string;
  status: "ISSUED" | "RETURNED" | "LOST" | "DAMAGED";
  issuedAt: string;
  returnedAt?: string;
  notes?: string;
  issuedBy?: {
    name: string;
  };
  returnedBy?: {
    name: string;
  };
  uniformNumber: string;
}

interface UniformsListProps {
  userId: string;
  refreshKey?: number;
  canModify?: boolean;
}

export function UniformsList({ userId, refreshKey = 0, canModify = true }: UniformsListProps) {
  const [uniforms, setUniforms] = useState<Uniform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUniform, setSelectedUniform] = useState<Uniform | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [uniformToDelete, setUniformToDelete] = useState<Uniform | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [updateNotes, setUpdateNotes] = useState<string>("");

  useEffect(() => {
    async function fetchUniforms() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/users/${userId}/uniforms`);
        if (!response.ok) {
          throw new Error('Failed to fetch uniforms');
        }
        const data = await response.json();
        setUniforms(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch uniforms');
        toast.error('Failed to load uniforms');
      } finally {
        setLoading(false);
      }
    }

    fetchUniforms();
  }, [userId, refreshKey]);

  const handleUpdateClick = (uniform: Uniform) => {
    if (!canModify) return;
    setSelectedUniform(uniform);
    setUpdateStatus(uniform.status);
    setUpdateNotes(uniform.notes || "");
    setUpdateDialogOpen(true);
  };

  const handleUpdateSubmit = async () => {
    if (!selectedUniform) return;
    if (!canModify) return;

    try {
      setIsUpdating(true);
      const response = await fetch(`/api/users/${userId}/uniforms/${selectedUniform.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: updateStatus,
          notes: updateNotes || undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to update uniform');

      toast.success("Uniform updated successfully");
      setUpdateDialogOpen(false);
      
      // Refresh the list
      const refreshResponse = await fetch(`/api/users/${userId}/uniforms`);
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setUniforms(data);
      }
    } catch (error) {
      console.error('Failed to update uniform:', error);
      toast.error('Failed to update uniform');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteClick = (uniform: Uniform) => {
    if (!canModify) return;
    setUniformToDelete(uniform);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!uniformToDelete) return;
    if (!canModify) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/users/${userId}/uniforms/${uniformToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete uniform');
      }

      toast.success("Uniform deleted successfully");
      setDeleteDialogOpen(false);
      
      // Refresh the list
      const refreshResponse = await fetch(`/api/users/${userId}/uniforms`);
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setUniforms(data);
      }
    } catch (error) {
      console.error('Failed to delete uniform:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete uniform');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ISSUED":
        return "bg-blue-100 text-blue-800";
      case "RETURNED":
        return "bg-green-100 text-green-800";
      case "LOST":
        return "bg-red-100 text-red-800";
      case "DAMAGED":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return <div className="p-4">Loading uniforms...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      {uniforms.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No uniforms issued yet.
        </div>
      ) : (
        <div className="space-y-4">
          {uniforms.map((uniform) => (
            <div key={uniform.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="font-medium">Shirt</h3>
                  <p className="text-sm text-gray-600">
                    {uniform.size && `Size: ${uniform.size}`} {uniform.uniformNumber && `• No: ${uniform.uniformNumber}`}
                  </p>
                  <p className="text-xs text-gray-500">
                    Issued on {new Date(uniform.issuedAt).toLocaleDateString()}
                    {uniform.issuedBy && ` by ${uniform.issuedBy.name}`}
                  </p>
                  {uniform.returnedAt && (
                    <p className="text-xs text-gray-500">
                      Returned on {new Date(uniform.returnedAt).toLocaleDateString()}
                      {uniform.returnedBy && ` by ${uniform.returnedBy.name}`}
                    </p>
                  )}
                  {uniform.notes && (
                    <p className="text-xs text-gray-600 italic">&#34;{uniform.notes}&#34;</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusColor(uniform.status)}>
                    {uniform.status}
                  </Badge>
                  {canModify && (
                    <div className="flex space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateClick(uniform)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {uniform.status === "ISSUED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(uniform)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Update Dialog */}
      {canModify && (
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Uniform Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={updateStatus} onValueChange={setUpdateStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ISSUED">Issued</SelectItem>
                  <SelectItem value="RETURNED">Returned</SelectItem>
                  <SelectItem value="LOST">Lost</SelectItem>
                  <SelectItem value="DAMAGED">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={updateNotes}
                onChange={(e) => setUpdateNotes(e.target.value)}
                placeholder="Enter any additional notes"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setUpdateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateSubmit} disabled={isUpdating}>
                {isUpdating ? "Updating..." : "Update"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}

      {/* Delete Dialog */}
      {canModify && (
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Uniform</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete this uniform record? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
} 
