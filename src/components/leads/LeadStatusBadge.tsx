import { Badge } from "@/components/ui/badge";
import { Clock, Phone, CheckCircle, XCircle } from "lucide-react";
import type { LeadStatus } from "@/types/database";
import { cn } from "@/lib/utils";

const statusConfig: Record<LeadStatus, { label: string; className: string; icon: typeof Clock }> = {
  new: {
    label: "New",
    className: "bg-primary/20 text-primary border-primary/30",
    icon: Clock,
  },
  contacted: {
    label: "Contacted",
    className: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
    icon: Phone,
  },
  converted: {
    label: "Converted",
    className: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30",
    icon: CheckCircle,
  },
  lost: {
    label: "Lost",
    className: "bg-muted text-muted-foreground border-muted-foreground/30",
    icon: XCircle,
  },
};

interface LeadStatusBadgeProps {
  status: LeadStatus;
  showIcon?: boolean;
  className?: string;
}

export function LeadStatusBadge({ status, showIcon = true, className }: LeadStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {config.label}
    </Badge>
  );
}
