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

export function DocumentExpiryWidget({
  expired,
  expiringSoon,
  branchId,
}: DocumentExpiryWidgetProps) {
  const total = expired.length + expiringSoon.length;

  if (total === 0) return null;

  const documentsLink = branchId
    ? `/branches/${branchId}/documents`
    : "/branches";

  return (
    <Card className="border-orange-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Document Alerts
        </CardTitle>
        <FileWarning className="h-4 w-4 text-orange-500" />
      </CardHeader>
      <CardContent className="space-y-3">
        {expired.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs font-medium text-red-600">
                Expired
              </span>
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {expired.length}
              </Badge>
            </div>
            <ul className="space-y-1">
              {expired.slice(0, 3).map((doc) => (
                <li key={doc.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">
                    {doc.name} - {doc.branch.name}
                  </span>
                  <span className="text-red-500 flex-shrink-0">
                    {format(new Date(doc.renewalDate), "dd MMM")}
                  </span>
                </li>
              ))}
              {expired.length > 3 && (
                <li className="text-xs text-muted-foreground">
                  +{expired.length - 3} more
                </li>
              )}
            </ul>
          </div>
        )}

        {expiringSoon.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-xs font-medium text-orange-600">
                Expiring Soon
              </span>
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {expiringSoon.length}
              </Badge>
            </div>
            <ul className="space-y-1">
              {expiringSoon.slice(0, 3).map((doc) => (
                <li key={doc.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">
                    {doc.name} - {doc.branch.name}
                  </span>
                  <span className="text-orange-500 flex-shrink-0">
                    {format(new Date(doc.renewalDate), "dd MMM")}
                  </span>
                </li>
              ))}
              {expiringSoon.length > 3 && (
                <li className="text-xs text-muted-foreground">
                  +{expiringSoon.length - 3} more
                </li>
              )}
            </ul>
          </div>
        )}

        <Link
          href={documentsLink}
          className="text-xs text-primary hover:underline block pt-1"
        >
          View all documents →
        </Link>
      </CardContent>
    </Card>
  );
}
