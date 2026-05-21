import { useState } from 'react'
import { Search as SearchIcon, FileText, Zap, Image } from 'lucide-react'
import api from '../lib/api'

const sourceColors = {
  upload:       'bg-blue-900 text-blue-300',
  google_drive: 'bg-green-900 text-green-300',
  notion:       'bg-purple-900 text-purple-300',
}

const MIN_DISPLAY_RELEVANCE = 0.55

function clampRelevance(score) {
  const value = Number(score)
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export default function Search() {
  const [query,        setQuery]        = useState('')
  const [results,      setResults]      = useState([])
  const [imageResults, setImageResults] = useState([])
  const [loading,      setLoading]      = useState(false)
  const [searched,     setSearched]     = useState(false)
  const [cacheHit,     setCacheHit]     = useState(false)
  const [error,        setError]        = useState('')

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    setError('')

    try {
      // ── Real API call — replaces mock data ──────
      const res = await api.post('/api/search', { query, top_k: 5 })

      setResults((res.data.results || []).filter(r => clampRelevance(r.score) >= MIN_DISPLAY_RELEVANCE))
      setImageResults((res.data.image_results || []).filter(r => clampRelevance(r.score) >= MIN_DISPLAY_RELEVANCE))
      setCacheHit(res.data.cache_hit    || false)

    } catch (err) {
      setError(err.response?.data?.error || 'Search failed. Please try again.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Search</h1>
      <p className="text-gray-400 mb-8">
        Search across all your documents using natural language
      </p>

      {/* Search input */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <SearchIcon size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="What do you want to find?"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl
                       pl-10 pr-4 py-3 text-white placeholder-gray-500
                       focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
        <button onClick={handleSearch} disabled={loading}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-500
                     disabled:opacity-50 text-white font-medium
                     rounded-xl transition-colors text-sm">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Cache hit badge — great for demos */}
      {cacheHit && (
        <div className="flex items-center gap-2 text-green-400 text-xs mb-4
                         bg-green-950 border border-green-900 rounded-lg
                         px-3 py-1.5 w-fit">
          <Zap size={12} />
          Result from Redis cache — instant response
        </div>
      )}

      {/* Error state */}
      {error && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}

      {/* Empty state */}
      {!searched && (
        <div className="text-center py-16 text-gray-500">
          <SearchIcon size={40} className="mx-auto mb-3 opacity-20" />
          <p>Type a question and press Enter</p>
          <p className="text-xs mt-2">
            Try: "What are the main points in my documents?"
          </p>
        </div>
      )}

      {/* Text results */}
      {searched && results.length === 0 && !loading && (
        <p className="text-gray-400 text-sm text-center py-8">
          No results found for "{query}"
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-3 mb-8">
          <p className="text-gray-400 text-xs">
            {results.length} text results
          </p>
          {results.map((r, i) => (
            <div key={r.id || i}
              className="bg-gray-900 border border-gray-800
                         hover:border-gray-600 rounded-xl p-5 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-white font-medium text-sm">
                    {r.file_name}
                  </span>
                  <span className="text-gray-500 text-xs">p.{r.page_no}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full
                    ${sourceColors[r.source] || 'bg-gray-800 text-gray-300'}`}>
                    {r.source?.replace('_', ' ')}
                  </span>
                  <span className="text-xs bg-gray-800 text-gray-300
                                   px-2 py-0.5 rounded-full font-mono">
                    {(clampRelevance(r.score) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed line-clamp-4">
                {r.chunk_text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Image results */}
      {imageResults.length > 0 && (
        <div>
          <p className="text-gray-400 text-xs mb-3 flex items-center gap-1.5">
            <Image size={12} /> {imageResults.length} image results
          </p>
          <div className="grid grid-cols-3 gap-3">
            {imageResults.map((img, i) => (
              <div key={i}
                className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                <div className="aspect-square bg-gray-800 rounded-lg mb-2
                                 flex items-center justify-center">
                  <Image size={24} className="text-gray-600" />
                </div>
                <p className="text-xs text-gray-400">Page {img.page_no}</p>
                <p className="text-xs text-gray-500 font-mono">
                  {(clampRelevance(img.score) * 100).toFixed(0)}% match
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}