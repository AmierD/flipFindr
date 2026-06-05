import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('favorites')
    .select('address, data, favorited_at')
    .eq('user_id', user.id)
    .order('favorited_at', { ascending: false })

  return Response.json({ favorites: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { address, data: cardData } = await request.json()
  const admin = createAdminClient()

  // Check if already favorited
  const { data: existing } = await admin
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('address', address)
    .single()

  if (existing) {
    // Remove favorite
    await admin.from('favorites').delete().eq('id', existing.id)
    return Response.json({ favorited: false })
  } else {
    // Add favorite
    await admin.from('favorites').insert({
      user_id: user.id,
      address,
      data: cardData,
      favorited_at: new Date().toISOString(),
    })
    return Response.json({ favorited: true })
  }
}
