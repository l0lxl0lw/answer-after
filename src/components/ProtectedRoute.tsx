import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
  const [provisioningComplete, setProvisioningComplete] = useState(false);
  const [redirectingToCheckout, setRedirectingToCheckout] = useState(false);

  // Check if user has incomplete signup (logged in but no organization)
  const hasIncompleteSignup = isAuthenticated && user && !user.organization_id;

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

  // Check if user needs to complete subscription setup (no Stripe subscription ID means checkout wasn't completed)
  const needsStripeCheckout = isAuthenticated && user?.organization_id && !isLoadingSubscription && 
    subscription && !subscription.stripe_subscription_id;

  // Handle incomplete signup (no organization)
  useEffect(() => {
    const completeSignup = async () => {
      if (!hasIncompleteSignup || isProvisioning || provisioningComplete || !session) return;

      setIsProvisioning(true);
      
      try {
        toast({
          title: "Completing setup...",
          description: "Setting up your organization.",
        });

        // Call provision-organization to complete signup
        const { data: provisionData, error: provisionError } = await supabase.functions.invoke(
          'provision-organization',
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (provisionError) {
          console.error('Provisioning error:', provisionError);
          toast({
            title: "Setup issue",
            description: "There was an issue completing setup. Redirecting to payment...",
            variant: "destructive",
          });
        } else {
          console.log('Provisioning complete:', provisionData);
        }

        // Now redirect to Stripe checkout
        await redirectToStripeCheckout();
      } catch (error) {
        console.error('Complete signup error:', error);
        toast({
          title: "Setup error",
          description: "An unexpected error occurred.",
          variant: "destructive",
        });
        setProvisioningComplete(true);
      } finally {
        setIsProvisioning(false);
      }
    };

    completeSignup();
  }, [hasIncompleteSignup, isProvisioning, provisioningComplete, session]);

  // Handle missing Stripe subscription (has org but checkout wasn't completed)
  useEffect(() => {
    const handleMissingStripeSubscription = async () => {
      if (!needsStripeCheckout || redirectingToCheckout || !session) return;
      
      await redirectToStripeCheckout();
    };

    handleMissingStripeSubscription();
  }, [needsStripeCheckout, redirectingToCheckout, session]);

  const redirectToStripeCheckout = async () => {
    if (!session) return;
    
    setRedirectingToCheckout(true);
    
    toast({
      title: "Redirecting to payment...",
      description: "Please complete your subscription setup.",
    });

    try {
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
        'create-checkout-with-trial',
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (checkoutError || !checkoutData?.url) {
        console.error('Checkout error:', checkoutError);
        toast({
          title: "Payment setup failed",
          description: "Please try again or contact support.",
          variant: "destructive",
        });
        setProvisioningComplete(true);
        setRedirectingToCheckout(false);
      } else {
        // Redirect to Stripe Checkout
        window.location.href = checkoutData.url;
      }
    } catch (error) {
      console.error('Checkout redirect error:', error);
      toast({
        title: "Payment setup failed",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      setRedirectingToCheckout(false);
    }
  };

  if (isLoading || isProvisioning || isLoadingSubscription || redirectingToCheckout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">
            {isProvisioning ? "Completing your account setup..." : 
             redirectingToCheckout ? "Redirecting to payment..." :
             "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
