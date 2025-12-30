import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCheck,
  AlertCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/hooks/use-api";
import { useGoogleConnectionGuard } from "@/hooks/useGoogleConnectionGuard";

interface SMSMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  body: string;
  status: string;
  created_at: string;
  error_code: string | null;
  error_message: string | null;
  contact_name?: string;
}

// Raw Google Contact structure from API
interface RawGoogleContact {
  resourceName: string;
  names?: Array<{ displayName?: string; givenName?: string }>;
  phoneNumbers?: Array<{ value?: string; canonicalForm?: string }>;
}

// Normalize phone number for comparison
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
}

// Extract phone numbers from contact for matching
function getContactPhones(contact: RawGoogleContact): string[] {
  const phones: string[] = [];
  if (contact.phoneNumbers) {
    contact.phoneNumbers.forEach(pn => {
      if (pn.canonicalForm) phones.push(normalizePhone(pn.canonicalForm));
      if (pn.value) phones.push(normalizePhone(pn.value));
    });
  }
  return [...new Set(phones)];
}

// Get display name from contact
function getContactDisplayName(contact: RawGoogleContact): string {
  return contact.names?.[0]?.displayName || contact.names?.[0]?.givenName || 'Unknown';
}

function getStatusBadge(status: string, direction: string) {
  if (direction === "inbound") {
    return { variant: "secondary" as const, label: "Received", icon: ArrowDownLeft };
  }
  
  switch (status) {
    case "delivered":
      return { variant: "default" as const, label: "Delivered", icon: CheckCheck };
    case "sent":
      return { variant: "secondary" as const, label: "Sent", icon: Send };
    case "queued":
    case "sending":
      return { variant: "outline" as const, label: "Sending", icon: Clock };
    case "failed":
    case "undelivered":
      return { variant: "destructive" as const, label: "Failed", icon: AlertCircle };
    default:
      return { variant: "outline" as const, label: status, icon: Clock };
  }
}

function SMSItem({ message }: { message: SMSMessage }) {
  const badge = getStatusBadge(message.status, message.direction);
  const timeAgo = formatDistanceToNow(new Date(message.created_at), { addSuffix: true });
  const displayName = message.contact_name || (message.direction === "inbound" ? message.from : message.to);
  const isInbound = message.direction === "inbound";

  return (
    <div className="flex items-start gap-4 p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
        isInbound ? 'bg-sky-500/10' : 'bg-emerald-500/10'
      }`}>
        {isInbound ? (
          <ArrowDownLeft className="w-5 h-5 text-sky-600" />
        ) : (
          <ArrowUpRight className="w-5 h-5 text-emerald-600" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{displayName}</span>
            <Badge variant={badge.variant} className="text-xs gap-1">
              <badge.icon className="w-3 h-3" />
              {badge.label}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo}</span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{message.body}</p>
        {message.error_message && (
          <p className="text-xs text-destructive mt-1">{message.error_message}</p>
        )}
      </div>
    </div>
  );
}

const SMS = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: organization } = useOrganization();
  const { checkGoogleError } = useGoogleConnectionGuard();

  // Fetch SMS messages from Twilio
  const { data: smsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sms-messages', organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-twilio-sms');
      if (error) throw error;
      return data as { messages: SMSMessage[]; meta: { total: number } };
    },
    enabled: !!organization?.id,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch Google Contacts for name mapping
  const { data: googleContacts } = useQuery({
    queryKey: ['google-contacts-sms', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      try {
        const { data, error } = await supabase.functions.invoke('google-contacts', {
          body: { action: 'list', organizationId: organization.id }
        });
        
        // Check for Google connection error and redirect
        if (checkGoogleError(error, data)) {
          return [];
        }
        
        if (error) {
          console.log('Google contacts not available:', error);
          return [];
        }
        return data?.contacts as RawGoogleContact[] || [];
      } catch (e) {
        console.log('Google contacts fetch failed:', e);
        return [];
      }
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Build phone-to-name map
  const phoneToContactName = useMemo(() => {
    const map = new Map<string, string>();
    if (googleContacts) {
      googleContacts.forEach((contact) => {
        const name = getContactDisplayName(contact);
        const phones = getContactPhones(contact);
        phones.forEach(phone => {
          map.set(phone, name);
        });
      });
    }
    return map;
  }, [googleContacts]);

  // Enrich messages with contact names
  const enrichedMessages = useMemo(() => {
    if (!smsData?.messages) return [];
    return smsData.messages.map(msg => {
      const phoneToMatch = msg.direction === 'inbound' ? msg.from : msg.to;
      const contactName = phoneToContactName.get(normalizePhone(phoneToMatch));
      return { ...msg, contact_name: contactName };
    });
  }, [smsData?.messages, phoneToContactName]);

  // Filter messages based on search
  const filteredMessages = enrichedMessages.filter(msg => 
    msg.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.to.includes(searchQuery) ||
    msg.from.includes(searchQuery) ||
    msg.contact_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const totalMessages = enrichedMessages.length;
  const inboundCount = enrichedMessages.filter(m => m.direction === "inbound").length;
  const outboundCount = enrichedMessages.filter(m => m.direction === "outbound").length;
  const deliveredCount = enrichedMessages.filter(m => m.status === "delivered").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold mb-1">Messages</h1>
            <p className="text-muted-foreground text-sm">
              View and manage automated SMS communications.
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '-' : totalMessages}</p>
                  <p className="text-xs text-muted-foreground">Total Messages</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                  <ArrowDownLeft className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '-' : inboundCount}</p>
                  <p className="text-xs text-muted-foreground">Inbound</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '-' : outboundCount}</p>
                  <p className="text-xs text-muted-foreground">Outbound</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <CheckCheck className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '-' : deliveredCount}</p>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Messages List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-base font-semibold">Message History</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredMessages.length > 0 ? (
              <div>
                {filteredMessages.map((message) => (
                  <SMSItem key={message.id} message={message} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No messages found</p>
                {searchQuery && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Try adjusting your search query
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SMS;