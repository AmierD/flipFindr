import { createAdminClient } from '@/lib/supabase/server'

// Called by Vercel Cron on the 4th of each month.
// Vercel sends CRON_SECRET as a bearer token; validate it to prevent abuse.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('request_counter')
    .update({ request_count: 0, last_reset: new Date().toISOString() })
    .eq('id', 1)

  if (error) {
    return Response.json({ error: 'Reset failed' }, { status: 500 })
  }

  return Response.json({ ok: true, reset_at: new Date().toISOString() })
}
