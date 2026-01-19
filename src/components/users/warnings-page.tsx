"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WarningForm } from "@/components/users/warning-form";
import { WarningsList } from "@/components/users/warnings-list";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WarningsPageProps {
  userId: string;
  userName?: string | null;
  canRegister?: boolean;
  canArchive?: boolean;
}

export function WarningsPage({ userId, userName, canRegister = false, canArchive = false }: WarningsPageProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [archivingAll, setArchivingAll] = useState(false);

  const refresh = () => setRefreshKey((k) => k + 1);

  const archiveAllActive = async () => {
    try {
      setArchivingAll(true);
      const res = await fetch(`/api/users/${userId}/warnings/archive`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to archive warnings");
      }
      const data = await res.json();
      toast.success(`Archived ${data.archivedCount ?? 0} warnings`);
      refresh();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to archive warnings");
    } finally {
      setArchivingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-2xl font-bold">Warnings</h2>
          <p className="text-sm text-muted-foreground">{userName ? `For ${userName}` : ""}</p>
        </div>
        <div className="flex gap-2">
          {canRegister ? <WarningForm userId={userId} userName={userName} onSuccess={refresh} /> : null}
        </div>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {canArchive ? (
            <div className="flex justify-end">
              <Button variant="outline" onClick={archiveAllActive} disabled={archivingAll}>
                {archivingAll ? "Archiving..." : "Archive All Active"}
              </Button>
            </div>
          ) : null}

          <WarningsList userId={userId} archived={false} canArchive={canArchive} refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="archived" className="space-y-4">
          <WarningsList userId={userId} archived={true} canArchive={canArchive} refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

