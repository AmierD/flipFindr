import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('request_counter')
    .select('request_count')
    .eq('id', 1)
    .single()

  const count = data?.request_count ?? 0
  const remaining = Math.max(0, 50 - count)

  return Response.json({ remaining, used: count, limit: 50 })
}
