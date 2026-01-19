"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateOnly } from "@/lib/utils";
import { FileSignature } from "lucide-react";

interface JoiningFormCardProps {
  userId: string;
  isSigned: boolean;
  signedAt?: Date;
}

export function JoiningFormCard({ userId, isSigned, signedAt }: JoiningFormCardProps) {
  const handleClick = () => {
    if (!isSigned) {
      window.open(`/users/${userId}/joining-form-signature`, '_blank');
    }
  };

  return (
    <div 
      className={isSigned ? "" : "cursor-pointer"}
      onClick={handleClick}
    >
      <Card className={`${isSigned ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200 hover:bg-orange-100 transition-colors"}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileSignature className="h-4 w-4" />
          Appointment Letter
        </CardTitle>
        <Badge variant={isSigned ? "default" : "destructive"} className="text-xs">
          {isSigned ? "Complete" : "Pending"}
        </Badge>
        </CardHeader>
        <CardContent>
          {isSigned ? (
            <div>
              <div className="text-2xl font-bold text-green-600">✓ Signed</div>
              <p className="text-xs text-muted-foreground">
                Completed on {signedAt ? formatDateOnly(signedAt) : 'N/A'}
              </p>
            </div>
          ) : (
            <div>
              <div className="text-2xl font-bold text-orange-600">Action Required</div>
              <p className="text-xs text-muted-foreground">
                Click to sign your appointment letter
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 