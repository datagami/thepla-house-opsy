"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateOnly } from '@/lib/utils';
import { User } from '@/models/models';
import { CheckCircle, XCircle, Calendar, User as UserIcon } from 'lucide-react';

interface SignatureStatusProps {
  user: User;
  currentUserId: string;
  canManageUsers: boolean;
  // Optional prop to allow branch managers to sign for users in their branch
  isBranchManagerForUser?: boolean;
}

export function SignatureStatus({ user, currentUserId, canManageUsers, isBranchManagerForUser = false }: SignatureStatusProps) {
  const isSigned = !!user.joiningFormSignedAt;
  const isOwnForm = currentUserId === user.id;

  const handleSignForm = () => {
    window.open(`/users/${user.id}/joining-form-signature`, '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          Joining Form Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSigned ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-600">Signed</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-600">Not Signed</span>
              </>
            )}
          </div>
          <Badge variant={isSigned ? "default" : "destructive"}>
            {isSigned ? "Complete" : "Pending"}
          </Badge>
        </div>

        {isSigned ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>Signed on: {formatDateOnly(user.joiningFormSignedAt!)}</span>
            </div>
            
            {user.joiningFormSignature && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Digital Signature:</label>
                <div className="border rounded-lg p-4 bg-gray-50">
                  <img
                    src={user.joiningFormSignature}
                    alt="Digital Signature"
                    className="max-w-full h-auto max-h-32 object-contain"
                  />
                </div>
              </div>
            )}
            
            <div className="text-sm text-gray-600">
              <p>✓ Agreement accepted</p>
              <p>✓ Digital signature captured</p>
              <p>✓ Form legally binding</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              The joining form needs to be signed to complete the onboarding process.
            </p>
            
            {(isOwnForm || canManageUsers || isBranchManagerForUser) && (
              <Button onClick={handleSignForm} className="w-full">
                Sign Joining Form
              </Button>
            )}
            
            {!isOwnForm && !canManageUsers && !isBranchManagerForUser && (
              <p className="text-sm text-orange-600">
                Please contact HR to sign your joining form.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 