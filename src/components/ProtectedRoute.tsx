import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, session, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Skip Edge Function requirements in development mode
  const isDevelopment = import.meta.env.MODE === 'development' || !import.meta.env.PROD;

  // Check if user has incomplete signup (logged in but no account)
  // Skip auto-provisioning in development mode - users should set up manually via SQL
  const hasIncompleteSignup = !isDevelopment && isAuthenticated && user && !user.account_id;

  // Fetch organization, subscription, and phone number status
  const { data: onboardingData, isLoading: isLoadingOnboarding } = useQuery({
    queryKey: ['onboarding-status', user?.account_id],
    queryFn: async () => {
      if (!user?.account_id) return null;

      // Fetch organization onboarding status
      const { data: org, error: orgError } = await supabase
        .from('accounts')
        .select('is_onboarding_complete')
        .eq('id', user.account_id)
        .single();

      if (orgError) {
        console.error('Error fetching organization:', orgError);
        return null;
      }

      // Fetch subscription
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('account_id', user.account_id)
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
      }

      // Fetch phone numbers
      const { data: phoneNumbers, error: phoneError } = await supabase
        .from('phone_numbers')
        .select('id')
        .eq('account_id', user.account_id)
        .limit(1);

      if (phoneError) {
        console.error('Error fetching phone numbers:', phoneError);
      }

      return {
        isOnboardingComplete: org?.is_onboarding_complete || false,
        hasSubscription: !!subscription?.stripe_subscription_id,
        hasPhoneNumber: phoneNumbers && phoneNumbers.length > 0,
        subscription,
      };
    },
    enabled: !!user?.account_id && !hasIncompleteSignup,
  });

  // Check onboarding paths
  const isOnboardingPath = location.pathname.startsWith('/onboarding');
  const isSelectPlanPath = location.pathname === '/onboarding/select-plan';

  // Determine onboarding redirect based on completion status
  // Skip when already on onboarding path to avoid redirect loops
  let onboardingRedirect: string | null = null;

  if (isAuthenticated && user?.account_id && !isLoadingOnboarding && onboardingData && !isOnboardingPath) {
    // If onboarding is not complete, determine which step they need
    if (!onboardingData.isOnboardingComplete) {
      // In production, check subscription first (Step 1)
      if (!isDevelopment && !onboardingData.hasSubscription) {
        onboardingRedirect = '/onboarding/select-plan';
      }
      // Phone number is now purchased in SetupServices, so skip directly there
      else {
        onboardingRedirect = '/onboarding/setup';
      }
    }
  }

  // Handle incomplete signup (no organization)
  useEffect(() => {
    const completeSignup = async () => {
      if (!hasIncompleteSignup || isProvisioning || !session) return;

      setIsProvisioning(true);
      
      try {
        toast({
          title: "Completing setup...",
          description: "Setting up your account.",
        });

        // Call provision-organization to complete signup
        const { error: provisionError } = await supabase.functions.invoke(
          'provision-account',
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (provisionError) {
          console.error('Provisioning error:', provisionError);
        }
      } catch (error) {
        console.error('Complete signup error:', error);
      } finally {
        setIsProvisioning(false);
      }
    };

    completeSignup();
  }, [hasIncompleteSignup, isProvisioning, session]);

  if (isLoading || isProvisioning || isLoadingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">
            {isProvisioning ? "Completing your account setup..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Redirect to appropriate onboarding step if not complete
  if (onboardingRedirect) {
    return <Navigate to={onboardingRedirect} replace />;
  }

  return <>{children}</>;
}
