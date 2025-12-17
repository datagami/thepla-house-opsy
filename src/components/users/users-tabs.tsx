"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserTable } from "./user-table";
import { Branch, User } from "@/models/models";

interface UsersTabsProps {
  users: User[];
  branches: Branch[];
  currentUserRole: string;
  canEdit: boolean;
}

export function UsersTabs({ users, branches, currentUserRole, canEdit }: UsersTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userStateParam = searchParams.get("userState");
  // Validate userState parameter - default to "active" if invalid
  const validUserState = userStateParam === "active" || userStateParam === "inactive" || userStateParam === "pending"
    ? userStateParam 
    : "active";
  const [activeTab, setActiveTab] = useState<string>(validUserState);

  // Sync tab state with URL parameter
  useEffect(() => {
    setActiveTab(validUserState);
  }, [validUserState]);

  // Filter users based on status
  const activeUsers = users.filter((user) => user.status === "ACTIVE");
  const inactiveUsers = users.filter((user) => user.status === "INACTIVE");
  const pendingUsers = users.filter((user) => user.status === "PENDING");

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set("userState", value);
    router.replace(`/users?${params.toString()}`);
    setActiveTab(value);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
      <TabsList>
        <TabsTrigger value="active">
          Active ({activeUsers.length})
        </TabsTrigger>
        <TabsTrigger value="pending">
          Pending ({pendingUsers.length})
        </TabsTrigger>
        <TabsTrigger value="inactive">
          Inactive ({inactiveUsers.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="space-y-4">
        <UserTable 
          users={activeUsers} 
          branches={branches} 
          currentUserRole={currentUserRole} 
          canEdit={canEdit} 
        />
      </TabsContent>

      <TabsContent value="pending" className="space-y-4">
        <UserTable 
          users={pendingUsers} 
          branches={branches} 
          currentUserRole={currentUserRole} 
          canEdit={canEdit} 
        />
      </TabsContent>

      <TabsContent value="inactive" className="space-y-4">
        <UserTable 
          users={inactiveUsers} 
          branches={branches} 
          currentUserRole={currentUserRole} 
          canEdit={canEdit} 
        />
      </TabsContent>
    </Tabs>
  );
}
