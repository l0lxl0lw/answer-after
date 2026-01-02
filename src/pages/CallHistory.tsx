import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Phone,
  PhoneIncoming,
  Clock,
  Search,
  ChevronRight,
  CheckCircle,
  XCircle,
  HelpCircle,
  User,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversations, type Conversation } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

// Format duration from seconds to MM:SS
function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
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

// Conversation Row Component
function ConversationRow({ conversation }: { conversation: Conversation }) {
  const badge = getStatusBadge(conversation.status, conversation.call_successful);
  const BadgeIcon = badge.icon;

  return (
    <Link
      to={`/dashboard/calls/${conversation.conversation_id}`}
      className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10">
          <PhoneIncoming className="w-6 h-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium truncate group-hover:text-primary transition-colors">
              Call #{conversation.conversation_id.slice(-6)}
            </p>
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

  const { data, isLoading } = useConversations({
    search: search || undefined,
  });

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
            Call Log
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
                  placeholder="Search conversations..."
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
          <div className="text-sm text-muted-foreground">
            {isLoading ? (
              <Skeleton className="h-4 w-32 inline-block" />
            ) : (
              <>
                Showing <strong>{data?.conversations.length ?? 0}</strong> conversations
                {data?.meta.has_more && " (more available)"}
              </>
            )}
          </div>
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
          ) : data?.conversations && data.conversations.length > 0 ? (
            data.conversations.map((conv) => (
              <ConversationRow key={conv.id} conversation={conv} />
            ))
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
