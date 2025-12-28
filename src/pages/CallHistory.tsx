import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Phone,
  PhoneIncoming,
  Clock,
  Search,
  ChevronRight,
  MessageSquare,
  CheckCircle,
  XCircle,
  HelpCircle,
  User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversations, useCalls, type Conversation } from "@/hooks/use-api";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useGoogleConnectionGuard } from "@/hooks/useGoogleConnectionGuard";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";

interface GoogleContact {
  resourceName: string;
  names?: Array<{ givenName?: string; familyName?: string; displayName?: string }>;
  phoneNumbers?: Array<{ value: string; type?: string }>;
}

// Format duration from seconds to MM:SS
function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Normalize phone number for comparison (strip all non-digits)
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10); // Get last 10 digits
}

// Get status badge based on call success
function getStatusBadge(status: string, callSuccessful: string | null) {
  if (status !== "completed") {
    return { variant: "outline" as const, label: "In Progress", icon: HelpCircle };
  }
  
  switch (callSuccessful) {
    case "success":
      return { variant: "default" as const, label: "Successful", icon: CheckCircle };
    case "failure":
      return { variant: "destructive" as const, label: "Failed", icon: XCircle };
    default:
      return { variant: "secondary" as const, label: "Completed", icon: CheckCircle };
  }
}

// Hook to fetch Google Contacts for phone number matching
function useGoogleContacts() {
  const { user } = useAuth();
  const { checkGoogleError } = useGoogleConnectionGuard();
  const { data: connection } = useGoogleCalendarConnection();
  
  return useQuery({
    queryKey: ["google-contacts-for-calls", user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return [];
      
      try {
        const { data, error } = await supabase.functions.invoke("google-contacts", {
          body: { action: "list", organizationId: user.organization_id },
        });

        // Check for Google connection error and redirect
        if (checkGoogleError(error, data)) {
          return [];
        }

        if (error) {
          console.error("Failed to fetch contacts:", error);
          return [];
        }
        
        return (data?.contacts || []) as GoogleContact[];
      } catch (e) {
        console.error("Failed to fetch contacts:", e);
        return [];
      }
    },
    enabled: !!user?.organization_id && !!connection,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false,
  });
}

// Conversation Row Component with contact name lookup
function ConversationRow({ 
  conversation, 
  callerPhone,
  contactName 
}: { 
  conversation: Conversation;
  callerPhone?: string;
  contactName?: string;
}) {
  const badge = getStatusBadge(conversation.status, conversation.call_successful);
  const BadgeIcon = badge.icon;
  
  const displayName = contactName || callerPhone || "Unknown Caller";
  const hasContactName = !!contactName;

  return (
    <Link
      to={`/dashboard/calls/${conversation.conversation_id}`}
      className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10">
          {hasContactName ? (
            <User className="w-6 h-6 text-primary" />
          ) : (
            <PhoneIncoming className="w-6 h-6 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium truncate group-hover:text-primary transition-colors">
              {displayName}
            </p>
            {hasContactName && callerPhone && (
              <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                {callerPhone}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {conversation.summary || "No summary available"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6 flex-shrink-0 ml-4">
        {/* Date & Time */}
        <div className="text-right hidden md:block">
          <p className="text-sm font-medium">
            {format(new Date(conversation.started_at), "MMM d, yyyy")}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(conversation.started_at), "h:mm a")}
          </p>
        </div>
        
        {/* Duration */}
        <div className="text-right hidden sm:block">
          <p className="text-sm flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatDuration(conversation.duration_seconds)}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {conversation.message_count} messages
          </p>
        </div>
        
        {/* Status Badge */}
        <Badge variant={badge.variant} className="flex items-center gap-1">
          <BadgeIcon className="w-3 h-3" />
          {badge.label}
        </Badge>
        
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}

export default function CallHistory() {
  const [search, setSearch] = useState("");

  const { data: conversationsData, isLoading: conversationsLoading } = useConversations({
    search: search || undefined,
  });
  
  const { data: callsData, isLoading: callsLoading } = useCalls();
  const { data: contacts } = useGoogleContacts();
  
  const isLoading = conversationsLoading || callsLoading;

  // Build a map of phone numbers to contact names
  const phoneToContactName = useMemo(() => {
    const map = new Map<string, string>();
    
    if (contacts) {
      for (const contact of contacts) {
        const name = contact.names?.[0]?.displayName || contact.names?.[0]?.givenName;
        if (name && contact.phoneNumbers) {
          for (const phone of contact.phoneNumbers) {
            const normalized = normalizePhone(phone.value);
            if (normalized.length >= 10) {
              map.set(normalized, name);
            }
          }
        }
      }
    }
    
    return map;
  }, [contacts]);

  // Build a map of conversation times to Twilio call phone numbers
  // This matches ElevenLabs conversations to Twilio calls by timestamp
  const conversationToPhone = useMemo(() => {
    const map = new Map<string, string>();
    
    if (callsData?.calls && conversationsData?.conversations) {
      for (const conv of conversationsData.conversations) {
        const convTime = new Date(conv.started_at).getTime();
        
        // Find a Twilio call that started within 60 seconds of this conversation
        const matchingCall = callsData.calls.find((call: any) => {
          const callTime = new Date(call.started_at).getTime();
          return Math.abs(callTime - convTime) < 60000; // Within 1 minute
        });
        
        if (matchingCall) {
          map.set(conv.conversation_id, matchingCall.caller_phone);
        }
      }
    }
    
    return map;
  }, [callsData, conversationsData]);

  // Get contact name for a phone number
  const getContactName = (phone: string | undefined): string | undefined => {
    if (!phone) return undefined;
    const normalized = normalizePhone(phone);
    return phoneToContactName.get(normalized);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">
            Conversation History
          </h1>
          <p className="text-muted-foreground">
            View all AI agent conversations with transcripts and details
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations by transcript content..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results Summary */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              <Skeleton className="h-4 w-32 inline-block" />
            ) : (
              <>
                Showing <strong>{conversationsData?.conversations.length ?? 0}</strong> conversations
                {conversationsData?.meta.has_more && " (more available)"}
              </>
            )}
          </p>
        </div>

        {/* Conversation List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="space-y-3"
        >
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))
          ) : conversationsData?.conversations && conversationsData.conversations.length > 0 ? (
            conversationsData.conversations.map((conv) => {
              const callerPhone = conversationToPhone.get(conv.conversation_id);
              const contactName = getContactName(callerPhone);
              
              return (
                <ConversationRow 
                  key={conv.id} 
                  conversation={conv}
                  callerPhone={callerPhone}
                  contactName={contactName}
                />
              );
            })
          ) : (
            <Card className="py-12">
              <CardContent className="text-center">
                <Phone className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="font-medium mb-2">No conversations found</h3>
                <p className="text-sm text-muted-foreground">
                  {search
                    ? "Try adjusting your search"
                    : "Conversations will appear here when calls come in"}
                </p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
