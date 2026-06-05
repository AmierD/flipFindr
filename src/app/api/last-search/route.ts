import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('last_search')
    .select('search_params, results, searched_at')
    .eq('user_id', user.id)
    .single()

  if (!data) return Response.json({ lastSearch: null })
  return Response.json({ lastSearch: data })
}
