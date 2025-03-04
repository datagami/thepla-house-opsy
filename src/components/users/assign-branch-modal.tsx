import { useEffect, useState } from 'react';
import { Branch } from '@/models/models';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuContent } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import {useRouter} from "next/navigation";

interface AssignBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (branchId: string) => Promise<void>;
  branches: Branch[];
  currentBranchId?: string;
}

const AssignBranchModal = ({
  isOpen,
  onClose,
  onAssign,
  branches,
  currentBranchId
}: AssignBranchModalProps) => {
  const [selectedBranchId, setSelectedBranchId] = useState(currentBranchId || '');
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(
    branches.find(branch => branch.id === currentBranchId) || null
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const hasChanges = selectedBranchId !== currentBranchId;
  const router = useRouter();
  

  useEffect(() => {
    const currentBranch = branches.find(branch => branch.id === currentBranchId);
    setSelectedBranch(currentBranch || null);
  }, [currentBranchId, branches]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onAssign(selectedBranchId);
      toast.success('Branch assigned successfully');
      router.refresh();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to assign branch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Assign Branch</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Branch
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full justify-between items-center px-3 py-2 border rounded-md">
                {selectedBranch?.name || 'Select Branch'}
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                {branches.map((branch) => (
                  <DropdownMenuItem 
                    key={branch.id} 
                    onClick={() => {
                      setSelectedBranchId(branch.id);
                      setSelectedBranch(branch);
                    }}
                    className={branch.id === currentBranchId ? "bg-accent" : ""}
                  >
                    {branch.name}
                    {branch.id === currentBranchId && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !hasChanges}
            >
              {loading ? 'Assigning...' : 'Assign Branch'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignBranchModal; 
