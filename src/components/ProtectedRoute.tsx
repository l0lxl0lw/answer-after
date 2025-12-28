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

  // Check if user has incomplete signup (logged in but no organization)
  // Skip auto-provisioning in development mode - users should set up manually via SQL
  const hasIncompleteSignup = !isDevelopment && isAuthenticated && user && !user.organization_id;

  // Fetch subscription status for users with organization
  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['subscription', user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', user.organization_id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        return null;
      }
      return data;
    },
    enabled: !!user?.organization_id && !hasIncompleteSignup,
  });

  // Check onboarding paths
  const isOnboardingPath = location.pathname.startsWith('/onboarding');
  const isSelectPlanPath = location.pathname === '/onboarding/select-plan';
  const isPhonePath = location.pathname === '/onboarding/phone';

  // Check if user needs to complete subscription setup (no Stripe subscription ID means checkout wasn't completed)
  // Skip in development mode and when already on onboarding path
  const needsPlanSelection = !isDevelopment && isAuthenticated && user?.organization_id && !isLoadingSubscription &&
    subscription && !subscription.stripe_subscription_id && !isOnboardingPath;

  // Handle incomplete signup (no organization)
  useEffect(() => {
    const completeSignup = async () => {
      if (!hasIncompleteSignup || isProvisioning || !session) return;

      setIsProvisioning(true);
      
      try {
        toast({
          title: "Completing setup...",
          description: "Setting up your organization.",
        });

        // Call provision-organization to complete signup
        const { error: provisionError } = await supabase.functions.invoke(
          'provision-organization',
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

  if (isLoading || isProvisioning || isLoadingSubscription) {
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

  // Redirect to plan selection if no Stripe subscription
  if (needsPlanSelection) {
    return <Navigate to="/onboarding/select-plan" replace />;
  }

  return <>{children}</>;
}
