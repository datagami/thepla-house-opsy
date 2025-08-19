"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileSignature, CheckCircle, XCircle, Calendar, ArrowRight } from 'lucide-react';
import { User } from '@/models/models';

interface EmployeeJoiningFormWidgetProps {
  currentUser: User;
}

export function EmployeeJoiningFormWidget({ currentUser }: EmployeeJoiningFormWidgetProps) {
  const isSigned = !!currentUser.joiningFormSignedAt;

  const handleSignForm = () => {
    window.open(`/users/${currentUser.id}/joining-form-signature`, '_blank');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileSignature className="h-4 w-4" />
          Appointment Letter Status
        </CardTitle>
        <Badge variant={isSigned ? "default" : "destructive"} className="text-xs">
          {isSigned ? "Complete" : "Pending"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {isSigned ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-600">Letter Signed</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-600">Letter Not Signed</span>
              </>
            )}
          </div>

          {isSigned ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>Signed on: {new Date(currentUser.joiningFormSignedAt!).toLocaleDateString()}</span>
              </div>
              <div className="text-sm text-gray-600">
                <p>✓ Agreement accepted</p>
                <p>✓ Digital signature captured</p>
                <p>✓ Letter legally binding</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Please sign your appointment letter to complete the onboarding process and access all features.
              </p>
              <Button onClick={handleSignForm} className="w-full">
                Sign Appointment Letter
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 