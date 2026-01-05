import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoAuthProvider } from "@/lib/demo/DemoAuthContext";
import { isDemoMode } from "@/lib/demo/config";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { EnvironmentBadge } from "@/components/EnvironmentBadge";
import { DemoBanner } from "@/components/DemoBanner";
import { getEnvironment } from "@/lib/logger";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import CallHistory from "./pages/CallHistory";
import SMS from "./pages/SMS";
import CallDetail from "./pages/CallDetail";
import Schedules from "./pages/Schedules";
import Customers from "./pages/Customers";
import Leads from "./pages/Leads";
import Settings from "./pages/Settings";
import Integrations from "./pages/Integrations";
import Subscriptions from "./pages/Subscriptions";
import MyAgent from "./pages/MyAgent";
import MyServices from "./pages/MyServices";
import Team from "./pages/Team";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import Widget from "./pages/Widget";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import SelectPlan from "./pages/onboarding/SelectPlan";
import UpgradePrompt from "./pages/onboarding/UpgradePrompt";
import PhoneSetup from "./pages/onboarding/PhoneSetup";
import SetupServices from "./pages/onboarding/SetupServices";
import TestCall from "./pages/onboarding/TestCall";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import AdminAccess from "./pages/AdminAccess";

const queryClient = new QueryClient();

// Admin portal only available in non-production environments
const isProduction = getEnvironment() === 'prod';

// Choose auth provider based on demo mode
const AppAuthProvider = isDemoMode() ? DemoAuthProvider : AuthProvider;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppAuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {isDemoMode() && <DemoBanner />}
        {!isDemoMode() && <EnvironmentBadge />}
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Auth />} />
            {/* Admin portal hidden in production - use pre-prod environment instead */}
            {!isProduction && <Route path="/adminaccess" element={<AdminAccess />} />}
            <Route path="/onboarding/select-plan" element={<ProtectedRoute><SelectPlan /></ProtectedRoute>} />
            <Route path="/onboarding/upgrade" element={<ProtectedRoute><UpgradePrompt /></ProtectedRoute>} />
            <Route path="/onboarding/phone" element={<ProtectedRoute><PhoneSetup /></ProtectedRoute>} />
            <Route path="/onboarding/setup" element={<ProtectedRoute><SetupServices /></ProtectedRoute>} />
            <Route path="/onboarding/test-call" element={<ProtectedRoute><TestCall /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/calls" element={<ProtectedRoute><CallHistory /></ProtectedRoute>} />
            <Route path="/dashboard/calls/:id" element={<ProtectedRoute><CallDetail /></ProtectedRoute>} />
            <Route path="/dashboard/messages" element={<ProtectedRoute><SMS /></ProtectedRoute>} />
            <Route path="/dashboard/calendar" element={<ProtectedRoute><Schedules /></ProtectedRoute>} />
            <Route path="/dashboard/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
            <Route path="/dashboard/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
            <Route path="/dashboard/voice-behavior" element={<ProtectedRoute><MyAgent /></ProtectedRoute>} />
            <Route path="/dashboard/services" element={<ProtectedRoute><MyServices /></ProtectedRoute>} />
            <Route path="/dashboard/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
            <Route path="/dashboard/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
            <Route path="/dashboard/account" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/dashboard/subscriptions" element={<ProtectedRoute><Subscriptions /></ProtectedRoute>} />
            <Route path="/dashboard/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
            <Route path="/dashboard/campaigns/:id" element={<ProtectedRoute><CampaignDetail /></ProtectedRoute>} />
            <Route path="/dashboard/widget" element={<ProtectedRoute><Widget /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppAuthProvider>
  </QueryClientProvider>
);

export default App;
