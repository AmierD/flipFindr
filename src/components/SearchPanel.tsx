'use client'

import { useState } from 'react'
import { HeartIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'

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
  const [favorited, setFavorited] = useState(false)
  const [toggling, setToggling] = useState(false)

  async function toggleFavorite() {
    setToggling(true)
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: result.address, data: result }),
      })
      const json = await res.json()
      if (res.ok) setFavorited(json.favorited)
    } finally {
      setToggling(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{result.address}</CardTitle>
        <CardDescription>
          {result.bedrooms} bed · {result.bathrooms} bath ·{' '}
          {result.squareFootage.toLocaleString()} sqft
        </CardDescription>
        {!result.meetsEquityTarget && (
          <CardAction>
            <Badge variant="secondary">Below $50k target</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">List Price</span>
            <span>{formatDollars(result.listPrice)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Est. Market Value</span>
            <span>{formatDollars(result.estimatedMarketValue)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium">
            <span>Est. Equity</span>
            <span>{formatDollars(result.estimatedEquity)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground mt-2 border-t pt-2">
            <span>Nearby range</span>
            <span>
              {result.minNearbyPrice !== null && result.maxNearbyPrice !== null
                ? `${formatDollars(result.minNearbyPrice)} – ${formatDollars(result.maxNearbyPrice)}`
                : 'No nearby comps found'}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleFavorite}
          disabled={toggling}
        >
          <HeartIcon
            data-icon="inline-start"
            className={favorited ? 'fill-current text-destructive' : ''}
          />
          {favorited ? 'Saved' : 'Save'}
        </Button>
      </CardFooter>
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
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Flip Finder</h1>

      <form onSubmit={handleSearch} className="flex flex-col gap-5">
        <FieldGroup>
          <Field>
            <FieldLabel>Search Area</FieldLabel>
            <ToggleGroup
              value={[mode]}
              onValueChange={(val) => val.length && setMode(val[val.length - 1] as 'city' | 'radius')}
              variant="outline"
              spacing={0}
            >
              <ToggleGroupItem value="city">City</ToggleGroupItem>
              <ToggleGroupItem value="radius">Radius</ToggleGroupItem>
            </ToggleGroup>
          </Field>

          {mode === 'city' ? (
            <div className="flex gap-2">
              <Field className="flex-1">
                <FieldLabel htmlFor="city">City</FieldLabel>
                <Input id="city" placeholder="Memphis" value={city} onChange={(e) => setCity(e.target.value)} required />
              </Field>
              <Field className="w-24">
                <FieldLabel htmlFor="state">State</FieldLabel>
                <Input id="state" placeholder="TN" value={state} onChange={(e) => setState(e.target.value)} maxLength={2} required />
              </Field>
            </div>
          ) : (
            <div className="flex gap-2">
              <Field className="flex-1">
                <FieldLabel htmlFor="address">Address</FieldLabel>
                <Input id="address" placeholder="123 Main St, Memphis TN" value={address} onChange={(e) => setAddress(e.target.value)} required />
              </Field>
              <Field className="w-24">
                <FieldLabel htmlFor="miles">Miles</FieldLabel>
                <Input id="miles" type="number" placeholder="10" value={miles} onChange={(e) => setMiles(e.target.value)} min={1} max={100} required />
              </Field>
            </div>
          )}
        </FieldGroup>

        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="maxPrice">Max Price</FieldLabel>
              <Input id="maxPrice" type="number" placeholder="300000" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} min={1} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="minBeds">Min Beds</FieldLabel>
              <Input id="minBeds" type="number" placeholder="3" value={minBeds} onChange={(e) => setMinBeds(e.target.value)} min={1} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="minBaths">Min Baths</FieldLabel>
              <Input id="minBaths" type="number" placeholder="2" value={minBaths} onChange={(e) => setMinBaths(e.target.value)} min={1} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="minSqft">Min Sqft</FieldLabel>
              <Input id="minSqft" type="number" placeholder="1200" value={minSqft} onChange={(e) => setMinSqft(e.target.value)} min={1} required />
            </Field>
          </div>
        </FieldGroup>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Searches remaining:{' '}
            <span className="font-medium text-foreground">{remaining} / 50</span>
          </p>
          <Button type="submit" disabled={loading}>
            <SearchIcon data-icon="inline-start" />
            {loading ? 'Searching…' : 'Run Search'}
          </Button>
        </div>
      </form>

      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      {emptyMessage && (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      )}

      {results && results.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''}, sorted by estimated equity
          </p>
          {results.map((r, i) => (
            <ResultCardView key={i} result={r} />
          ))}
        </div>
      )}
    </div>
  )
}
