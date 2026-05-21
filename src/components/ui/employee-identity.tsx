import * as React from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getInitials, stringToHue } from "@/lib/utils";
import type { EmployeeIdentityUser } from "@/models/models";

type Size = "sm" | "md" | "lg";

/**
 * Identity display for an employee: avatar + name + #numId.
 *
 * The default subtitle line shows `#numId`. Passing `subtitle` REPLACES
 * the #numId line entirely. To keep both, render numId in your subtitle:
 * `subtitle={<>#{user.numId} · {user.role}</>}`.
 */
interface EmployeeIdentityProps {
  user: EmployeeIdentityUser;
  size?: Size;
  subtitle?: React.ReactNode;
  href?: string;
  className?: string;
}

const AVATAR_SIZE: Record<Size, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-12 w-12 text-base",
};

const NAME_TEXT: Record<Size, string> = {
  sm: "text-sm font-medium leading-tight",
  md: "text-sm font-medium leading-tight",
  lg: "text-base font-semibold leading-tight",
};

const ID_TEXT: Record<Size, string> = {
  sm: "text-xs text-muted-foreground",
  md: "text-xs text-muted-foreground leading-tight",
  lg: "text-sm text-muted-foreground leading-tight",
};

export function EmployeeIdentity({
  user,
  size = "md",
  subtitle,
  href,
  className,
}: EmployeeIdentityProps) {
  const initials = getInitials(user.name);
  const hue = user.name ? stringToHue(user.name) : null;
  const fallbackStyle = hue !== null
    ? { backgroundColor: `hsl(${hue} 60% 50%)`, color: "white" }
    : { backgroundColor: "hsl(0 0% 80%)", color: "white" };

  const idLine = subtitle ?? (user.numId != null ? `#${user.numId}` : null);

  const inner = (
    <div
      className={cn(
        "inline-flex items-center gap-2 min-w-0",
        className,
      )}
    >
      <Avatar className={cn(AVATAR_SIZE[size], "shrink-0")}>
        {user.image ? (
          <AvatarImage
            src={user.image}
            alt={user.name ?? "Employee"}
            loading="lazy"
          />
        ) : null}
        <AvatarFallback style={fallbackStyle}>{initials}</AvatarFallback>
      </Avatar>

      {size === "sm" ? (
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className={cn(NAME_TEXT[size], "truncate")}>{user.name ?? "Unnamed"}</span>
          {idLine !== null && (
            <span className={cn(ID_TEXT[size], "shrink-0")}>· {idLine}</span>
          )}
        </div>
      ) : (
        <div className="min-w-0">
          <div className={cn(NAME_TEXT[size], "truncate")}>
            {user.name ?? "Unnamed"}
          </div>
          {idLine !== null && (
            <div className={cn(ID_TEXT[size], "truncate")}>{idLine}</div>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:underline">
        {inner}
      </Link>
    );
  }
  return inner;
}
