'use client'

import { useRouter } from 'next/navigation'
import { UserDataImportExport } from './user-data-import-export'

export function UserDataActions() {
  const router = useRouter()

  const handleImportComplete = () => {
    router.refresh()
  }

  return <UserDataImportExport onImportComplete={handleImportComplete} />
} 