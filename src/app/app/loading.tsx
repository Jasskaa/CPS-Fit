import { Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-12 w-48" /></div>
      <Skeleton className="h-72 w-full !rounded-3xl" />
      <div className="grid grid-cols-2 gap-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
