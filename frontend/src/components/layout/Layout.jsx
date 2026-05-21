import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="flex">
      <Sidebar />

      <main className="ml-60 flex-1 min-h-screen bg-gray-950 p-6">
        <header className="sticky top-0 z-20 bg-transparent backdrop-blur-sm py-4 mb-6">
          <div className="max-w-7xl mx-auto px-2 md:px-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-white">Workspace</h2>
              <p className="text-sm text-gray-400">Manage documents, connectors and AI</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:block">
                <input
                  placeholder="Search documents or ask AI..."
                  className="bg-gray-900 border border-gray-800 text-sm text-white rounded-xl px-3 py-2 w-72 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <button className="hidden md:inline-flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 text-sm text-white rounded-lg hover:bg-gray-800">
                Profile
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-2 md:px-4">{children}</div>
      </main>
    </div>
  )
}