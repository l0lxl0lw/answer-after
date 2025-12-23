import { useState } from "react";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Mock SMS data - will be replaced with real API data
const mockSmsMessages = [
  {
    id: "1",
    direction: "outbound" as const,
    to: "+1 (206) 778-0089",
    from: "+1 (555) 123-4567",
    body: "Hi! This is a reminder about your appointment tomorrow at 2:00 PM. Reply YES to confirm or NO to reschedule.",
    status: "delivered",
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    contact_name: "Testing",
  },
  {
    id: "2",
    direction: "inbound" as const,
    to: "+1 (555) 123-4567",
    from: "+1 (206) 778-0089",
    body: "YES",
    status: "received",
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    contact_name: "Testing",
  },
  {
    id: "3",
    direction: "outbound" as const,
    to: "+1 (425) 555-1234",
    from: "+1 (555) 123-4567",
    body: "Thank you for calling! We've received your request and will get back to you within 24 hours.",
    status: "delivered",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    contact_name: null,
  },
  {
    id: "4",
    direction: "outbound" as const,
    to: "+1 (360) 555-9876",
    from: "+1 (555) 123-4567",
    body: "Your appointment has been confirmed for Friday at 10:00 AM. See you then!",
    status: "failed",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    contact_name: null,
  },
];

function getStatusBadge(status: string, direction: string) {
  if (direction === "inbound") {
    return { variant: "secondary" as const, label: "Received", icon: ArrowDownLeft };
  }
  
  switch (status) {
    case "delivered":
      return { variant: "default" as const, label: "Delivered", icon: CheckCheck };
    case "sent":
      return { variant: "secondary" as const, label: "Sent", icon: ArrowUpRight };
    case "pending":
      return { variant: "outline" as const, label: "Pending", icon: Clock };
    case "failed":
      return { variant: "destructive" as const, label: "Failed", icon: AlertCircle };
    default:
      return { variant: "outline" as const, label: status, icon: Clock };
  }
}

function SMSItem({ message }: { message: typeof mockSmsMessages[0] }) {
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
      </div>
    </div>
  );
}

const SMS = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Filter messages based on search
  const filteredMessages = mockSmsMessages.filter(msg => 
    msg.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.to.includes(searchQuery) ||
    msg.from.includes(searchQuery) ||
    msg.contact_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const totalMessages = mockSmsMessages.length;
  const inboundCount = mockSmsMessages.filter(m => m.direction === "inbound").length;
  const outboundCount = mockSmsMessages.filter(m => m.direction === "outbound").length;
  const deliveredCount = mockSmsMessages.filter(m => m.status === "delivered").length;

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
            <h1 className="text-2xl font-bold mb-1">SMS Messages</h1>
            <p className="text-muted-foreground text-sm">
              View and manage automated SMS communications.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" />
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
                  <p className="text-2xl font-bold">{totalMessages}</p>
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
                  <p className="text-2xl font-bold">{inboundCount}</p>
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
                  <p className="text-2xl font-bold">{outboundCount}</p>
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
                  <p className="text-2xl font-bold">{deliveredCount}</p>
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