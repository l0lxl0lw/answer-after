import { getEnvironment } from '@/lib/logger';

export function EnvironmentBadge() {
  const env = getEnvironment();

  // Only show in non-production environments
  if (env === 'prod') return null;

  const getBadgeInfo = () => {
    switch (env) {
      case 'local':
        return { label: 'LOCAL', color: 'bg-blue-500' };
      case 'devo':
        return { label: 'PRE-PROD', color: 'bg-orange-500' };
      default:
        return { label: 'DEV', color: 'bg-purple-500' };
    }
  };

  const { label, color } = getBadgeInfo();

  return (
    <div
      className={`fixed bottom-8 right-8 px-8 py-4 rounded-lg text-white text-3xl font-mono font-bold ${color} z-50 shadow-2xl`}
      title={`Environment: ${env}`}
    >
      {label}
    </div>
  );
}
