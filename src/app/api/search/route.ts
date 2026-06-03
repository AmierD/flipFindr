import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'

const RENTCAST_BASE = 'https://api.rentcast.io/v1'
const REQUEST_LIMIT = 50
const AVM_COUNT = 4

type SearchMode = 'city' | 'radius'

interface SearchParams {
  mode: SearchMode
  city?: string
  state?: string
  address?: string
  miles?: number
  maxPrice: number
  minBeds: number
  minBaths: number
  minSqft: number
}

interface Listing {
  id: string
  formattedAddress: string
  city: string
  state: string
  zipCode: string
  bedrooms: number
  bathrooms: number
  squareFootage: number
  price: number
  latitude: number
  longitude: number
}

interface Comparable {
  price: number
  distance: number
}

interface AvmResponse {
  price: number
  priceRangeLow: number
  priceRangeHigh: number
  comparables: Comparable[]
}

interface ResultCard {
  address: string
  bedrooms: number
  bathrooms: number
  squareFootage: number
  listPrice: number
  estimatedMarketValue: number
  estimatedEquity: number
  minNearbyPrice: number | null
  maxNearbyPrice: number | null
  meetsEquityTarget: boolean
}

async function getRequestCount(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase
    .from('request_counter')
    .select('request_count')
    .eq('id', 1)
    .single()
  return (data?.request_count ?? 0) as number
}

async function incrementCounter(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase
    .from('request_counter')
    .select('request_count')
    .eq('id', 1)
    .single()
  const current = data?.request_count ?? 0
  const { error } = await supabase
    .from('request_counter')
    .update({ request_count: current + 1 })
    .eq('id', 1)
  if (error) console.error('Counter increment failed:', error.message)
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
  const res = await fetch(url, { headers: { 'User-Agent': 'flip-findr/1.0' } })
  const data = await res.json()
  if (!data[0]) throw new Error('GEOCODE_FAILED')
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

async function callRentcast(url: string, supabase: ReturnType<typeof createAdminClient>): Promise<Response> {
  const count = await getRequestCount(supabase)
  if (count >= REQUEST_LIMIT) {
    throw new Error('LIMIT_REACHED')
  }

  const res = await fetch(url, {
    headers: { 'X-Api-Key': process.env.RENTCAST_API_KEY! },
  })

  if (!res.ok) {
    throw new Error(`RENTCAST_ERROR:${res.status}`)
  }

  await incrementCounter(supabase)
  return res
}

function buildListingsUrl(params: SearchParams & { lat?: number; lng?: number }): string {
  const url = new URL(`${RENTCAST_BASE}/listings/sale`)
  url.searchParams.set('propertyType', 'Single Family')
  url.searchParams.set('status', 'Active')
  url.searchParams.set('limit', '500')
  url.searchParams.set('price', `-${params.maxPrice}`)
  url.searchParams.set('bedrooms', `${params.minBeds}+`)
  url.searchParams.set('bathrooms', `${params.minBaths}+`)
  url.searchParams.set('squareFootage', `${params.minSqft}+`)

  if (params.mode === 'city') {
    url.searchParams.set('city', params.city!)
    url.searchParams.set('state', params.state!)
  } else {
    url.searchParams.set('latitude', String(params.lat))
    url.searchParams.set('longitude', String(params.lng))
    url.searchParams.set('radius', String(params.miles))
  }

  return url.toString()
}

function cacheKeyForListings(params: SearchParams): string {
  const str = JSON.stringify({
    mode: params.mode,
    city: params.city,
    state: params.state,
    address: params.address,
    miles: params.miles,
    maxPrice: params.maxPrice,
    minBeds: params.minBeds,
    minBaths: params.minBaths,
    minSqft: params.minSqft,
  })
  return crypto.createHash('sha256').update(str).digest('hex')
}

function sevenDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString()
}

function proxyRank(listings: Listing[]): Listing[] {
  const withPpsf = listings.map((l) => ({
    listing: l,
    ppsf: l.squareFootage > 0 ? l.price / l.squareFootage : Infinity,
  }))
  withPpsf.sort((a, b) => a.ppsf - b.ppsf)
  return withPpsf.map((x) => x.listing)
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  let params: SearchParams
  try {
    params = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // --- Check request budget ---
  const count = await getRequestCount(supabase)
  if (count >= REQUEST_LIMIT) {
    return Response.json(
      { error: 'Monthly search limit reached. Resets on the 4th.' },
      { status: 429 }
    )
  }

  // --- Geocode address for radius mode ---
  let geocoded: { lat: number; lng: number } | undefined
  if (params.mode === 'radius') {
    try {
      geocoded = await geocodeAddress(params.address!)
    } catch {
      return Response.json({ error: 'Could not locate that address. Try a more specific address.' }, { status: 400 })
    }
  }

  // --- Fetch listings (cache check first) ---
  const cacheKey = cacheKeyForListings(params)
  let listings: Listing[] | null = null

  const { data: cachedListings } = await supabase
    .from('listings_cache')
    .select('response')
    .eq('cache_key', cacheKey)
    .gte('created_at', sevenDaysAgo())
    .single()

  if (cachedListings) {
    listings = cachedListings.response as Listing[]
  } else {
    let listingsRes: Response
    try {
      listingsRes = await callRentcast(buildListingsUrl({ ...params, lat: geocoded?.lat, lng: geocoded?.lng }), supabase)
    } catch (err) {
      const msg = (err as Error).message
      if (msg === 'LIMIT_REACHED') {
        return Response.json(
          { error: 'Monthly search limit reached. Resets on the 4th.' },
          { status: 429 }
        )
      }
      return Response.json({ error: 'Search failed. Please try again.' }, { status: 502 })
    }

    listings = await listingsRes.json()

    // Cache the result
    await supabase.from('listings_cache').upsert({
      cache_key: cacheKey,
      response: listings,
      created_at: new Date().toISOString(),
    })
  }

  if (!listings || listings.length === 0) {
    return Response.json({ results: [], message: 'No listings found matching your filters. Try widening your search area or relaxing a filter.' })
  }

  // --- Proxy signal: rank by price/sqft, take top AVM_COUNT ---
  const ranked = proxyRank(listings).slice(0, AVM_COUNT)

  // --- Fetch AVM for each top listing ---
  const results: ResultCard[] = []

  for (const listing of ranked) {
    // Check AVM cache
    let avm: AvmResponse | null = null

    const { data: cachedAvm } = await supabase
      .from('avm_cache')
      .select('response')
      .eq('latitude', listing.latitude)
      .eq('longitude', listing.longitude)
      .gte('created_at', sevenDaysAgo())
      .single()

    if (cachedAvm) {
      avm = cachedAvm.response as AvmResponse
    } else {
      const avmUrl = new URL(`${RENTCAST_BASE}/avm/value`)
      avmUrl.searchParams.set('latitude', String(listing.latitude))
      avmUrl.searchParams.set('longitude', String(listing.longitude))
      avmUrl.searchParams.set('maxRadius', '0.5')
      avmUrl.searchParams.set('compCount', '25')

      try {
        const avmRes = await callRentcast(avmUrl.toString(), supabase)
        avm = await avmRes.json()

        await supabase.from('avm_cache').upsert({
          latitude: listing.latitude,
          longitude: listing.longitude,
          response: avm,
          created_at: new Date().toISOString(),
        })
      } catch (err) {
        const msg = (err as Error).message
        if (msg === 'LIMIT_REACHED') {
          // Budget exhausted mid-loop — return what we have so far
          break
        }
        // Skip this listing on Rentcast error, don't add to results
        continue
      }
    }

    const estimatedMarketValue = avm!.price
    const estimatedEquity = estimatedMarketValue - listing.price
    const comps = avm!.comparables ?? []
    const minNearbyPrice = comps.length > 0 ? Math.min(...comps.map((c) => c.price)) : null
    const maxNearbyPrice = comps.length > 0 ? Math.max(...comps.map((c) => c.price)) : null

    results.push({
      address: listing.formattedAddress,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      squareFootage: listing.squareFootage,
      listPrice: listing.price,
      estimatedMarketValue,
      estimatedEquity,
      minNearbyPrice,
      maxNearbyPrice,
      meetsEquityTarget: estimatedEquity >= 50000,
    })
  }

  // Sort by estimatedEquity descending
  results.sort((a, b) => b.estimatedEquity - a.estimatedEquity)

  // Return remaining count after this operation
  const updatedCount = await getRequestCount(supabase)
  const remaining = Math.max(0, REQUEST_LIMIT - updatedCount)

  return Response.json({ results, remaining })
}
