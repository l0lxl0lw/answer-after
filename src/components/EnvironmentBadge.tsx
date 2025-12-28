export function EnvironmentBadge() {
  // Only show in non-production builds
  if (import.meta.env.PROD) return null;

  const env = import.meta.env.MODE;
  const url = import.meta.env.VITE_SUPABASE_URL;

  const getBadgeInfo = () => {
    if (url?.includes('localhost') || url?.includes('127.0.0.1')) {
      return { label: 'LOCAL', color: 'bg-blue-500' };
    }
    return { label: 'DEV', color: 'bg-purple-500' };
  };

  const { label, color } = getBadgeInfo();

  return (
    <div
      className={`fixed bottom-8 right-8 px-8 py-4 rounded-lg text-white text-3xl font-mono font-bold ${color} z-50 shadow-2xl`}
      title={`Environment: ${env} | Supabase: ${url}`}
    >
      {label}
    </div>
  );
}
