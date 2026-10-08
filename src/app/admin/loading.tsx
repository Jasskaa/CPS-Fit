import { Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2"><Skeleton className="h-12 w-64" /><Skeleton className="h-4 w-80" /></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-64 w-full" />
      <div className="grid gap-4 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}</div>
    </div>
  )
}
