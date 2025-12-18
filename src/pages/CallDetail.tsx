import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Phone,
  PhoneIncoming,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Play,
  User,
  Bot,
  Calendar,
  MapPin,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Zap,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCall } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import type { CallEvent, CallTranscript } from "@/types/database";

// Format duration from seconds to MM:SS
function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Get icon for event type
function getEventIcon(eventType: string) {
  switch (eventType) {
    case "initiated":
      return Phone;
    case "greeting":
      return MessageSquare;
    case "qualification":
      return FileText;
    case "emergency_detected":
      return AlertTriangle;
    case "non_emergency":
      return CheckCircle2;
    case "dispatched":
      return Zap;
    case "appointment_booked":
      return Calendar;
    case "completed":
      return CheckCircle2;
    case "failed":
      return XCircle;
    default:
      return Phone;
  }
}

// Get color for event type
function getEventColor(eventType: string) {
  switch (eventType) {
    case "emergency_detected":
    case "failed":
      return "text-destructive bg-destructive/10 border-destructive/20";
    case "dispatched":
    case "appointment_booked":
      return "text-success bg-success/10 border-success/20";
    case "completed":
      return "text-success bg-success/10 border-success/20";
    case "greeting":
    case "qualification":
      return "text-info bg-info/10 border-info/20";
    default:
      return "text-primary bg-primary/10 border-primary/20";
  }
}

// Timeline Event Component
function TimelineEvent({ event, index }: { event: CallEvent; index: number }) {
  const Icon = getEventIcon(event.event_type);
  const colorClass = getEventColor(event.event_type);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="relative pl-8 pb-8 last:pb-0"
    >
      {/* Timeline line */}
      <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border last:hidden" />
      
      {/* Event dot */}
      <div
        className={cn(
          "absolute left-0 w-8 h-8 rounded-full border-2 flex items-center justify-center",
          colorClass
        )}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Event content */}
      <div className="bg-card border border-border rounded-xl p-4 ml-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium capitalize">
            {event.event_type.replace(/_/g, " ")}
          </h4>
          <span className="text-xs text-muted-foreground">
            {format(new Date(event.created_at), "h:mm:ss a")}
          </span>
        </div>

        {event.ai_response && (
          <div className="mb-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2 mb-1">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-primary">AI Response</span>
            </div>
            <p className="text-sm">{event.ai_response}</p>
          </div>
        )}

        {event.ai_prompt && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">AI Prompt</span>
            </div>
            <p className="text-sm text-muted-foreground">{event.ai_prompt}</p>
          </div>
        )}

        {event.event_data && Object.keys(event.event_data).length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            <pre className="bg-muted/30 p-2 rounded overflow-x-auto">
              {JSON.stringify(event.event_data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Transcript Message Component
function TranscriptMessage({ transcript, index }: { transcript: CallTranscript; index: number }) {
  const isAI = transcript.speaker === "ai" || transcript.speaker === "assistant" || transcript.speaker === "system";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className={cn("flex gap-3 mb-4", isAI ? "justify-start" : "justify-end")}
    >
      {isAI && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10 mt-5">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className={cn("max-w-[75%]", isAI ? "items-start" : "items-end")}>
        <p className={cn("text-xs font-medium mb-1", isAI ? "text-primary" : "text-muted-foreground text-right")}>
          {isAI ? "AI Assistant" : "Customer"}
        </p>
        <div
          className={cn(
            "p-3 rounded-2xl",
            isAI
              ? "bg-muted rounded-tl-sm"
              : "bg-primary text-primary-foreground rounded-tr-sm"
          )}
        >
          <p className="text-sm">{transcript.content}</p>
          <div
            className={cn(
              "flex items-center gap-2 mt-1 text-xs",
              isAI ? "text-muted-foreground" : "text-primary-foreground/70"
            )}
          >
            {transcript.timestamp_ms && (
              <span>{formatDuration(Math.floor(transcript.timestamp_ms / 1000))}</span>
            )}
            {transcript.confidence && transcript.confidence < 1 && (
              <span>• {Math.round(transcript.confidence * 100)}% confidence</span>
            )}
          </div>
        </div>
      </div>
      {!isAI && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-muted mt-5">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  );
}

export default function CallDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: call, isLoading } = useCall(id || "");

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

  if (!call) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Phone className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="font-display text-xl font-bold mb-2">Call not found</h2>
          <p className="text-muted-foreground mb-4">
            The call you're looking for doesn't exist or has been removed.
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
              <div
                className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center",
                  call.is_emergency ? "bg-destructive/10" : "bg-primary/10"
                )}
              >
                {call.is_emergency ? (
                  <AlertTriangle className="w-7 h-7 text-destructive" />
                ) : (
                  <PhoneIncoming className="w-7 h-7 text-primary" />
                )}
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold">
                  {call.caller_name || "Unknown Caller"}
                </h1>
                <p className="text-muted-foreground">{call.caller_phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {call.is_emergency && (
                <Badge variant="destructive" className="text-sm py-1 px-3">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Emergency
                </Badge>
              )}
              <Badge
                variant={call.outcome === "dispatched" || call.outcome === "booked" ? "default" : "secondary"}
                className="text-sm py-1 px-3 capitalize"
              >
                {call.outcome?.replace("_", " ") || "Pending"}
              </Badge>
              {call.recording_url && (
                <Button variant="outline" size="sm">
                  <Play className="w-4 h-4 mr-2" />
                  Play Recording
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Call Info Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date & Time</p>
                <p className="font-medium text-sm">
                  {format(new Date(call.started_at), "MMM d, yyyy h:mm a")}
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
                  {formatDuration(call.duration_seconds)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone Line</p>
                <p className="font-medium text-sm">
                  {call.phone_number.friendly_name}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium text-sm capitalize">
                  {call.status.replace("_", " ")}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Summary */}
        {call.summary && (
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
                <p className="text-muted-foreground">{call.summary}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Tabs: Timeline & Transcript */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="timeline" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Timeline ({call.events.length})
              </TabsTrigger>
              <TabsTrigger value="transcript" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Transcript ({call.transcripts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Call Event Timeline</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Complete state transitions and AI interactions
                  </p>
                </CardHeader>
                <CardContent>
                  {call.events.length > 0 ? (
                    <div className="relative">
                      {call.events.map((event, index) => (
                        <TimelineEvent key={event.id} event={event} index={index} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No events recorded</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transcript" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Conversation Transcript</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Full call transcript with speaker identification
                  </p>
                </CardHeader>
                <CardContent>
                  {call.transcripts.length > 0 ? (
                    <ScrollArea className="h-[500px] pr-4">
                      {call.transcripts.map((transcript, index) => (
                        <TranscriptMessage
                          key={transcript.id}
                          transcript={transcript}
                          index={index}
                        />
                      ))}
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No transcript available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
