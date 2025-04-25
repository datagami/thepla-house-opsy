import Image from "next/image";
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center">
      <Image
        src="/app_logo.png"
        alt="OPSY Logo"
        width={120}
        height={32}
        className="rounded-md"
      />
    </Link>
  );
} 