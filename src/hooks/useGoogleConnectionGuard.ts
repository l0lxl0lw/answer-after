import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Check if an error is a Google connection error
export function isGoogleConnectionError(error: any, data: any): boolean {
  const errorMessage = data?.error || error?.message || String(error) || '';
  return errorMessage.includes('No valid Google connection') || 
         errorMessage.includes('No Google connection');
}

export function useGoogleConnectionGuard() {
  const navigate = useNavigate();
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Redirect when Google error is detected
  useEffect(() => {
    if (googleError) {
      navigate('/dashboard/integrations', { 
        state: { showGooglePrompt: true } 
      });
      setGoogleError(null);
    }
  }, [googleError, navigate]);

  // Call this to check and trigger redirect if needed
  const checkGoogleError = useCallback((error: any, data: any): boolean => {
    if (isGoogleConnectionError(error, data)) {
      setGoogleError(data?.error || error?.message || 'No Google connection');
      return true;
    }
    return false;
  }, []);

  return { checkGoogleError, googleError };
}
