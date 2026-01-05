// Demo mode banner shown at the top of the app
export function DemoBanner() {
  return (
    <>
      {/* Spacer to prevent content from being hidden under the fixed banner */}
      <div className="h-10" />
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-center py-2 px-4 text-sm font-medium shadow-lg">
        <span className="inline-flex items-center gap-2">
          <span className="animate-pulse">Demo Mode</span>
          <span className="opacity-75">|</span>
          <span className="opacity-90">Portfolio showcase with mock data - no real API calls</span>
        </span>
      </div>
    </>
  );
}
