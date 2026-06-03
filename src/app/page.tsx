import SearchPanel from '@/components/SearchPanel'
import { createAdminClient } from '@/lib/supabase/server'

export default async function Home() {
  let remaining = 10

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('request_counter')
      .select('request_count')
      .eq('id', 1)
      .single()
    const requestsUsed = data?.request_count ?? 0
    remaining = Math.max(0, 50 - requestsUsed)
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <SearchPanel initialRemaining={remaining} />
    </main>
  )
}
