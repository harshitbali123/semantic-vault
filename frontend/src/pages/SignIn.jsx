import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Sparkles, ShieldCheck, FileText, ArrowRight } from 'lucide-react'

export default function SignIn() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(email, password)

    if (error) {
      setError(error.message)
    } else {
      navigate('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(135deg,_#0b1020_0%,_#0f172a_42%,_#111827_100%)] text-white px-4 py-8 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-[0_30px_80px_rgba(15,23,42,0.5)] backdrop-blur-2xl">
        <section className="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 border-r border-white/10 bg-[linear-gradient(180deg,rgba(59,130,246,0.16),rgba(15,23,42,0.02))]">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_34%)]" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-100">
              <Sparkles size={14} />
              Knowledge workspace
            </div>

            <h1 className="mt-6 text-4xl xl:text-5xl font-semibold tracking-tight text-white">
              Secure access to your document intelligence.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              Sign in to manage files, explore connectors, and ask questions with source-backed answers in a clean, focused workspace.
            </p>
          </div>

          <div className="relative z-10 grid gap-3 text-sm text-slate-200">
            {[
              'Encrypted auth flow with role-based protected routes',
              'Quick navigation to dashboard, documents, connectors, and chat',
              'Built for fast review, uploads, and AI-assisted search',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <ShieldCheck size={16} className="text-cyan-300 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="relative z-10 mt-10 flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-slate-400">
            <FileText size={14} />
            KnowledgeAI
          </div>
        </section>

        <section className="p-6 sm:p-10 xl:p-14 bg-slate-950/90">
          <div className="mx-auto flex w-full max-w-md flex-col">
            <div className="mb-8 lg:hidden">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-100">
                <Sparkles size={14} />
                Knowledge workspace
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white">
                Welcome back
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Sign in to continue to your workspace.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 shadow-2xl">
              <div className="mb-6">
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-cyan-300">Sign in</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">Access your account</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Use your email and password to open the dashboard and continue where you left off.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-400">
                No account?{' '}
                <Link to="/signup" className="font-medium text-cyan-300 hover:text-cyan-200">
                  Create one
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}