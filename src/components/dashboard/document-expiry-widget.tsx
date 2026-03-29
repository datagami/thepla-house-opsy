import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, FileWarning, Calendar } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface ExpiringDocument {
  id: string;
  name: string;
  renewalDate: Date;
  branch: { id: string; name: string };
  documentType?: { name: string } | null;
}

interface DocumentExpiryWidgetProps {
  expired: ExpiringDocument[];
  expiringSoon: ExpiringDocument[];
  branchId?: string;
}

interface BranchGroup {
  branchId: string;
  branchName: string;
  expired: ExpiringDocument[];
  expiringSoon: ExpiringDocument[];
}

function groupByBranch(expired: ExpiringDocument[], expiringSoon: ExpiringDocument[]): BranchGroup[] {
  const map = new Map<string, BranchGroup>();

  for (const doc of expired) {
    if (!map.has(doc.branch.id)) {
      map.set(doc.branch.id, { branchId: doc.branch.id, branchName: doc.branch.name, expired: [], expiringSoon: [] });
    }
    map.get(doc.branch.id)!.expired.push(doc);
  }

  for (const doc of expiringSoon) {
    if (!map.has(doc.branch.id)) {
      map.set(doc.branch.id, { branchId: doc.branch.id, branchName: doc.branch.name, expired: [], expiringSoon: [] });
    }
    map.get(doc.branch.id)!.expiringSoon.push(doc);
  }

  // Sort: branches with expired docs first, then by name
  return Array.from(map.values()).sort((a, b) => {
    if (a.expired.length > 0 && b.expired.length === 0) return -1;
    if (a.expired.length === 0 && b.expired.length > 0) return 1;
    return a.branchName.localeCompare(b.branchName);
  });
}

export function DocumentExpiryWidget({
  expired,
  expiringSoon,
}: DocumentExpiryWidgetProps) {
  const total = expired.length + expiringSoon.length;

  if (total === 0) return null;

  const branches = groupByBranch(expired, expiringSoon);

  return (
    <div className="col-span-full space-y-3">
      <div className="flex items-center gap-2">
        <FileWarning className="h-4 w-4 text-orange-500" />
        <h3 className="text-sm font-semibold">Document Alerts</h3>
        <Badge variant="destructive" className="h-5 px-1.5 text-xs">
          {total}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch) => (
          <Link
            key={branch.branchId}
            href={`/branches/${branch.branchId}/documents`}
            className="block"
          >
            <Card className={`hover:bg-accent/5 transition-colors ${branch.expired.length > 0 ? 'border-red-200' : 'border-orange-200'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {branch.branchName}
                </CardTitle>
                <div className="flex gap-1.5">
                  {branch.expired.length > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                      {branch.expired.length} expired
                    </Badge>
                  )}
                  {branch.expiringSoon.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      {branch.expiringSoon.length} expiring
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {[...branch.expired, ...branch.expiringSoon].slice(0, 3).map((doc) => {
                    const isExpired = branch.expired.includes(doc);
                    return (
                      <li key={doc.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{doc.name}</span>
                        <span className={`flex-shrink-0 ${isExpired ? 'text-red-500' : 'text-orange-500'}`}>
                          {format(new Date(doc.renewalDate), "dd MMM yy")}
                        </span>
                      </li>
                    );
                  })}
                  {(branch.expired.length + branch.expiringSoon.length) > 3 && (
                    <li className="text-xs text-muted-foreground">
                      +{branch.expired.length + branch.expiringSoon.length - 3} more
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
