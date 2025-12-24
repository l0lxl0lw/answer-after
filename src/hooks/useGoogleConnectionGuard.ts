import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useGoogleConnectionGuard() {
  const navigate = useNavigate();

  const handleGoogleError = useCallback((error: any, data: any) => {
    // Check if the error is about missing Google connection
    const errorMessage = data?.error || error?.message || '';
    if (errorMessage.includes('No valid Google connection') || 
        errorMessage.includes('No Google connection')) {
      navigate('/dashboard/integrations', { 
        state: { showGooglePrompt: true } 
      });
      return true; // Error was handled
    }
    return false; // Error was not a Google connection error
  }, [navigate]);

  return { handleGoogleError };
}
