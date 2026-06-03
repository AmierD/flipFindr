'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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

interface Props {
  initialRemaining: number
}

function formatDollars(n: number): string {
  return '$' + n.toLocaleString('en-US')
}

function ResultCardView({ result }: { result: ResultCard }) {
  return (
    <Card className={result.meetsEquityTarget ? '' : 'opacity-70'}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold leading-snug">
          {result.address}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {result.bedrooms} bed &nbsp;·&nbsp; {result.bathrooms} bath &nbsp;·&nbsp;{' '}
          {result.squareFootage.toLocaleString()} sqft
        </p>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">List Price</span>
          <span>{formatDollars(result.listPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Est. Market Value</span>
          <span>{formatDollars(result.estimatedMarketValue)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Est. Equity</span>
          <span className={result.meetsEquityTarget ? 'text-green-600' : ''}>
            {formatDollars(result.estimatedEquity)}
          </span>
        </div>
        <div className="flex justify-between text-muted-foreground pt-1 border-t mt-2">
          <span>Nearby range</span>
          <span>
            {result.minNearbyPrice !== null && result.maxNearbyPrice !== null
              ? `${formatDollars(result.minNearbyPrice)} – ${formatDollars(result.maxNearbyPrice)}`
              : 'No nearby comps found'}
          </span>
        </div>
        {!result.meetsEquityTarget && (
          <div className="pt-1">
            <Badge variant="secondary">Below $50k target</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function SearchPanel({ initialRemaining }: Props) {
  const [mode, setMode] = useState<'city' | 'radius'>('city')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [address, setAddress] = useState('')
  const [miles, setMiles] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minBeds, setMinBeds] = useState('')
  const [minBaths, setMinBaths] = useState('')
  const [minSqft, setMinSqft] = useState('')

  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ResultCard[] | null>(null)
  const [emptyMessage, setEmptyMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [remaining, setRemaining] = useState(initialRemaining)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResults(null)
    setEmptyMessage('')
    setErrorMessage('')

    const body =
      mode === 'city'
        ? { mode, city, state, maxPrice: Number(maxPrice), minBeds: Number(minBeds), minBaths: Number(minBaths), minSqft: Number(minSqft) }
        : { mode, address, miles: Number(miles), maxPrice: Number(maxPrice), minBeds: Number(minBeds), minBaths: Number(minBaths), minSqft: Number(minSqft) }

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Something went wrong. Please try again.')
      } else if (data.results.length === 0) {
        setEmptyMessage(data.message ?? 'No listings found.')
      } else {
        setResults(data.results)
        if (typeof data.remaining === 'number') setRemaining(data.remaining)
      }
    } catch {
      setErrorMessage('Network error. Please try again.')
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Flip Finder</h1>

      <form onSubmit={handleSearch} className="space-y-5">
        {/* Search area */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Search Area</p>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'city' | 'radius')} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="city" id="mode-city" />
              <Label htmlFor="mode-city">City</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="radius" id="mode-radius" />
              <Label htmlFor="mode-radius">Radius</Label>
            </div>
          </RadioGroup>

          {mode === 'city' ? (
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="city">City</Label>
                <Input id="city" placeholder="Memphis" value={city} onChange={(e) => setCity(e.target.value)} required />
              </div>
              <div className="w-24 space-y-1">
                <Label htmlFor="state">State</Label>
                <Input id="state" placeholder="TN" value={state} onChange={(e) => setState(e.target.value)} maxLength={2} required />
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="address">Address</Label>
                <Input id="address" placeholder="123 Main St, Memphis TN" value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>
              <div className="w-24 space-y-1">
                <Label htmlFor="miles">Miles</Label>
                <Input id="miles" type="number" placeholder="10" value={miles} onChange={(e) => setMiles(e.target.value)} min={1} max={100} required />
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filters</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="maxPrice">Max Price</Label>
              <Input id="maxPrice" type="number" placeholder="300000" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} min={1} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="minBeds">Min Beds</Label>
              <Input id="minBeds" type="number" placeholder="3" value={minBeds} onChange={(e) => setMinBeds(e.target.value)} min={1} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="minBaths">Min Baths</Label>
              <Input id="minBaths" type="number" placeholder="2" value={minBaths} onChange={(e) => setMinBaths(e.target.value)} min={1} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="minSqft">Min Sqft</Label>
              <Input id="minSqft" type="number" placeholder="1200" value={minSqft} onChange={(e) => setMinSqft(e.target.value)} min={1} required />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Requests remaining: <span className="font-medium text-foreground">{remaining} / 50</span>
          </p>
          <Button type="submit" disabled={loading}>
            {loading ? 'Searching…' : 'Run Search'}
          </Button>
        </div>
      </form>

      {/* Error state */}
      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      {/* Empty state */}
      {emptyMessage && (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{results.length} result{results.length !== 1 ? 's' : ''}, sorted by estimated equity</p>
          {results.map((r, i) => (
            <ResultCardView key={i} result={r} />
          ))}
        </div>
      )}
    </div>
  )
}
