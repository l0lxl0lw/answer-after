import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import CallHistory from "./pages/CallHistory";
import SMS from "./pages/SMS";
import CallDetail from "./pages/CallDetail";
import Schedules from "./pages/Schedules";
import CalendarCallback from "./pages/CalendarCallback";
import CalendarSetupGuide from "./pages/CalendarSetupGuide";
import Contacts from "./pages/Contacts";
import Appointments from "./pages/Appointments";
import Settings from "./pages/Settings";
import Integrations from "./pages/Integrations";
import MyServices from "./pages/MyServices";
import Subscriptions from "./pages/Subscriptions";
import MyAgent from "./pages/MyAgent";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import SelectPlan from "./pages/onboarding/SelectPlan";
import PhoneSetup from "./pages/onboarding/PhoneSetup";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/onboarding/select-plan" element={<ProtectedRoute><SelectPlan /></ProtectedRoute>} />
            <Route path="/onboarding/phone" element={<ProtectedRoute><PhoneSetup /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/calls" element={<ProtectedRoute><CallHistory /></ProtectedRoute>} />
            <Route path="/dashboard/calls/:id" element={<ProtectedRoute><CallDetail /></ProtectedRoute>} />
            <Route path="/dashboard/sms" element={<ProtectedRoute><SMS /></ProtectedRoute>} />
            <Route path="/dashboard/schedules" element={<ProtectedRoute><Schedules /></ProtectedRoute>} />
            <Route path="/dashboard/schedules/callback" element={<ProtectedRoute><CalendarCallback /></ProtectedRoute>} />
            <Route path="/dashboard/calendar-setup" element={<ProtectedRoute><CalendarSetupGuide /></ProtectedRoute>} />
            <Route path="/dashboard/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
            <Route path="/dashboard/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
            <Route path="/dashboard/my-services" element={<ProtectedRoute><MyServices /></ProtectedRoute>} />
            <Route path="/dashboard/my-agent" element={<ProtectedRoute><MyAgent /></ProtectedRoute>} />
            <Route path="/dashboard/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/dashboard/subscriptions" element={<ProtectedRoute><Subscriptions /></ProtectedRoute>} />
            <Route path="/dashboard/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
