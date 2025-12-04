"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User } from '@/models/models';
import { FileSignature, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface PendingSignaturesWidgetProps {
  pendingUsers: User[];
  currentUserRole: string;
}

export function PendingSignaturesWidget({ pendingUsers, currentUserRole }: PendingSignaturesWidgetProps) {
  const canManageUsers = ['HR', 'MANAGEMENT'].includes(currentUserRole);
  
  if (!canManageUsers || pendingUsers.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileSignature className="h-4 w-4" />
          Pending Appointment Letter Signatures
        </CardTitle>
        <Badge variant="destructive" className="text-xs">
          {pendingUsers.length}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pendingUsers.slice(0, 5).map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{user.name}</p>
                  <p className="text-xs text-gray-500">
                    {user.role} • {user.department?.name || 'N/A'}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/users/${user.id}/joining-form-signature`, '_blank')}
              >
                Sign Letter
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          ))}
          
          {pendingUsers.length > 5 && (
            <div className="text-center pt-2">
              <Link href="/users">
                <Button variant="ghost" size="sm">
                  View all {pendingUsers.length} pending letters
                </Button>
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 