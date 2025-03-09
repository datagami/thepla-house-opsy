import { AdvanceRequestForm } from '@/components/advance-payment/advance-request-form'
import { AdvanceHistory } from '@/components/advance-payment/advance-history'

interface AdvancePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function AdvancePage({ params }: AdvancePageProps) {
  const { id } = await params;
  return (
    <div className="container mx-auto py-8">
      <h2 className="text-2xl font-bold mb-6">Advance Payment Management</h2>
      
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="text-xl font-semibold mb-4">Request Advance Payment</h3>
          <AdvanceRequestForm userId={id} />
        </div>
        
        <div>
          <AdvanceHistory userId={id} />
        </div>
      </div>
    </div>
  )
} 
