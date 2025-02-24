import { useState } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";

export function useTableState() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const page = searchParams.get("page") ?? "1";
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "all";
  const role = searchParams.get("role") ?? "all";
  const perPage = 10;

  const createQueryString = (params: Record<string, string | number | null>) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());

    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        newSearchParams.delete(key);
      } else {
        newSearchParams.set(key, String(value));
      }
    });

    return newSearchParams.toString();
  };

  const updateTable = (params: Record<string, string | number | null>) => {
    const queryString = createQueryString(params);
    replace(`${pathname}?${queryString}`);
  };

  return {
    page: Number(page),
    search,
    status,
    role,
    perPage,
    isLoading,
    setIsLoading,
    updateTable,
  };
} 