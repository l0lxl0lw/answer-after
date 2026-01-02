import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Phone,
  PhoneIncoming,
  Clock,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  XCircle,
  MessageSquare,
  FileText,
  HelpCircle,
  Volume2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Format duration from seconds to MM:SS
function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Get status badge info
function getStatusBadge(status: string, callSuccessful: string | null) {
  if (status !== "completed" && status !== "done") {
    return { variant: "outline" as const, label: "In Progress", icon: HelpCircle };
  }

  switch (callSuccessful) {
    case "success":
      return { variant: "default" as const, label: "Successful", icon: CheckCircle2 };
    case "failure":
      return { variant: "destructive" as const, label: "Failed", icon: XCircle };
    default:
      return { variant: "secondary" as const, label: "Completed", icon: CheckCircle2 };
  }
}

// Transcript message from ElevenLabs
interface TranscriptMessage {
  role: "user" | "agent";
  message: string;
  time_in_call_secs?: number;
}

// Transcript Message Component - ElevenLabs style
function TranscriptMessageRow({
  message,
  index,
  callStartTime
}: {
  message: TranscriptMessage;
  index: number;
  callStartTime: Date;
}) {
  const isAgent = message.role === "agent";

  // Calculate actual time by adding seconds to call start time
  const messageTime = message.time_in_call_secs !== undefined
    ? new Date(callStartTime.getTime() + message.time_in_call_secs * 1000)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className={cn("flex mb-4", isAgent ? "justify-start" : "justify-end")}
    >
      <div className={cn("max-w-[80%] flex flex-col", isAgent ? "items-start" : "items-end")}>
        {isAgent && (
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-xs text-muted-foreground">AI Assistant</span>
          </div>
        )}
        <div
          className={cn(
            "p-3 rounded-lg",
            isAgent
              ? "bg-muted"
              : "bg-zinc-800 text-white dark:bg-zinc-700"
          )}
        >
          <p className="text-sm">{message.message}</p>
        </div>
        {messageTime && (
          <p className="text-xs text-muted-foreground mt-1">
            {format(messageTime, "h:mm:ss a")}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// Hook to fetch ElevenLabs conversation details
function useElevenLabsConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ['elevenlabs-conversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-elevenlabs-conversation?conversation_id=${conversationId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch conversation');
      }

      return response.json();
    },
    enabled: !!conversationId,
  });
}

export default function CallDetail() {
  const { id: conversationId } = useParams<{ id: string }>();

  const { data: conversation, isLoading, error } = useElevenLabsConversation(conversationId || null);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !conversation) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Phone className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="font-display text-xl font-bold mb-2">Conversation not found</h2>
          <p className="text-muted-foreground mb-4">
            {error?.message || "The conversation you're looking for doesn't exist or has been removed."}
          </p>
          <Link to="/dashboard/calls">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Call History
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const badge = getStatusBadge(conversation.status, conversation.call_successful);
  const BadgeIcon = badge.icon;
  const transcript: TranscriptMessage[] = conversation.transcript || [];
  const recordingUrl = conversation.recording_url;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            to="/dashboard/calls"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Call History
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-primary/10">
                <PhoneIncoming className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold">
                  Call #{conversationId?.slice(-6)}
                </h1>
                <p className="text-muted-foreground">
                  {format(new Date(conversation.started_at), "MMMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>

            <Badge variant={badge.variant} className="text-sm py-1 px-3">
              <BadgeIcon className="w-3 h-3 mr-1" />
              {badge.label}
            </Badge>
          </div>
        </motion.div>

        {/* Call Info Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date & Time</p>
                <p className="font-medium text-sm">
                  {format(new Date(conversation.started_at), "MMM d, yyyy h:mm a")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-medium text-sm">
                  {formatDuration(conversation.duration_seconds)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Messages</p>
                <p className="font-medium text-sm">
                  {conversation.message_count || transcript.length} messages
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Summary */}
        {conversation.summary && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Call Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{conversation.summary}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Audio Player */}
        {recordingUrl && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.17 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-primary" />
                  Call Recording
                </CardTitle>
              </CardHeader>
              <CardContent>
                <audio
                  controls
                  src={recordingUrl}
                  className="w-full"
                  preload="metadata"
                >
                  Your browser does not support the audio element.
                </audio>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Transcript */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Conversation Transcript
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Full call transcript with speaker identification
              </p>
            </CardHeader>
            <CardContent>
              {transcript.length > 0 ? (
                <ScrollArea className="h-[500px] pr-4">
                  {transcript.map((message, index) => (
                    <TranscriptMessageRow
                      key={index}
                      message={message}
                      index={index}
                      callStartTime={new Date(conversation.started_at)}
                    />
                  ))}
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No transcript available for this call</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
