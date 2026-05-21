import { useState, useRef, useEffect } from 'react'
import { Send, FileText, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Chat() {
  const MIN_DISPLAY_RELEVANCE = 0.55
  const [messages,  setMessages]  = useState([])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const [drawer,    setDrawer]    = useState(null)
  const bottomRef  = useRef()
  const sourceRef  = useRef(null)   // holds the EventSource instance
  const finishedRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => sourceRef.current?.close()
  }, [])

  const sendMessage = async () => {
    if (!input.trim() || streaming) return
    const question = input.trim()
    setInput('')
    setStreaming(true)
    finishedRef.current = false

    // Add user message
    setMessages(prev => [...prev,
      { role: 'user', content: question }
    ])

    // Add empty assistant message we'll stream into
    setMessages(prev => [...prev,
      { role: 'assistant', content: '', citations: [], streaming: true }
    ])

    // ── Get current auth token ────────────────────
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) {
      setStreaming(false)
      return
    }

    // ── Open SSE connection ───────────────────────
    // EventSource doesn't support custom headers natively,
    // so we pass token as a query param
    // (Express auth middleware needs to handle this — see note below)
    const url = `http://localhost:3000/api/ask?question=${encodeURIComponent(question)}&token=${token}`
    const es  = new EventSource(url)
    sourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'token') {
          // Append token to the last message
          setMessages(prev => {
            const updated = [...prev]
            const last    = { ...updated[updated.length - 1] }
            last.content  = last.content + data.content.replace(/\\n/g, '\n')
            updated[updated.length - 1] = last
            return updated
          })
        }

        if (data.type === 'citations') {
          // Attach citations to the last message
          setMessages(prev => {
            const updated = [...prev]
            const last    = { ...updated[updated.length - 1] }
            last.citations = data.citations
            updated[updated.length - 1] = last
            return updated
          })
        }

        if (data.type === 'done' || data.type === 'error') {
          // Mark streaming complete
          finishedRef.current = true
          setMessages(prev => {
            const updated = [...prev]
            const last    = { ...updated[updated.length - 1] }
            last.streaming = false
            if (data.type === 'error') last.content = data.content
            updated[updated.length - 1] = last
            return updated
          })
          es.close()
          setStreaming(false)
        }

      } catch (parseErr) {
        console.error('[Chat] SSE parse error:', parseErr)
      }
    }

    es.onerror = () => {
      if (finishedRef.current) return
      es.close()
      setStreaming(false)
      setMessages(prev => {
        const updated = [...prev]
        const last    = { ...updated[updated.length - 1] }
        last.content   = last.content || 'Something went wrong. Please try again.'
        last.streaming = false
        updated[updated.length - 1] = last
        return updated
      })
    }
  }

  const renderWithCitations = (text, citations) => {
    if (!citations?.length) return text
    const parts = text.split(/(\[\d+\])/g)
    return parts.map((part, i) => {
      const match = part.match(/\[(\d+)\]/)
      if (match) {
        const cit = citations.find(c => c.id === parseInt(match[1]))
        return (
          <button key={i} onClick={() => cit && setDrawer(cit)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5
                       bg-blue-900 text-blue-300 text-xs rounded font-mono
                       hover:bg-blue-700 transition-colors">
            {part}
          </button>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  const clampRelevance = (score) => {
    const value = Number(score)
    if (Number.isNaN(value)) return 0
    return Math.max(0, Math.min(1, value))
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">Ask AI</h1>
        <p className="text-gray-400 text-sm">
          Ask questions, get answers with sources from your documents
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Ask anything about your documents</p>
            <p className="text-sm">Answers include citations to original sources</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role==='user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm
              ${msg.role==='user'
                ? 'bg-blue-600 text-white rounded-br-none'
                : 'bg-gray-900 border border-gray-800 text-gray-100 rounded-bl-none'}`}>
              {msg.role === 'assistant' ? (() => {
                const visibleCitations = (msg.citations || [])
                  .filter(c => clampRelevance(c.score) >= MIN_DISPLAY_RELEVANCE)

                return (
                  <>
                    <p className="leading-relaxed whitespace-pre-wrap">
                      {renderWithCitations(msg.content, visibleCitations)}
                      {msg.streaming && (
                        <span className="inline-block w-1.5 h-4 bg-blue-400
                                         ml-0.5 animate-pulse align-middle" />
                      )}
                    </p>
                    {visibleCitations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <p className="text-xs text-gray-500 mb-2">Sources</p>
                        <div className="flex flex-wrap gap-1.5">
                          {visibleCitations.map(c => (
                            <button key={c.id} onClick={() => setDrawer(c)}
                              className="flex items-center gap-1.5 px-2.5 py-1
                                         bg-gray-800 hover:bg-gray-700 rounded-lg
                                         text-xs text-gray-300 transition-colors">
                              <FileText size={10} />
                              {c.file_name} · p.{c.page_no}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              })() : msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3 pt-4 border-t border-gray-800">
        <input value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask a question about your documents..."
          disabled={streaming}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-xl
                     px-4 py-3 text-white placeholder-gray-500 text-sm
                     focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
        <button onClick={sendMessage}
          disabled={streaming || !input.trim()}
          className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                     text-white rounded-xl transition-colors">
          <Send size={16} />
        </button>
      </div>

      {/* Citation drawer */}
      {drawer && (
        <div className="fixed inset-0 bg-black/50 flex justify-end z-50"
          onClick={() => setDrawer(null)}>
          <div className="bg-gray-900 border-l border-gray-800 w-96
                          h-full p-6 overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-white font-semibold text-sm">
                  {drawer.file_name}
                </h3>
                <p className="text-gray-400 text-xs mt-1">
                  Page {drawer.page_no}
                  {clampRelevance(drawer.score) > 0 && ` · ${(clampRelevance(drawer.score)*100).toFixed(0)}% relevance`}
                </p>
              </div>
              <button onClick={() => setDrawer(null)}
                className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-gray-300 text-sm leading-relaxed">
                {drawer.chunk_text}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}