import { Badge } from "@/components/ui/badge";
import { Flame, Thermometer, Snowflake } from "lucide-react";
import type { InterestLevel } from "@/types/database";
import { cn } from "@/lib/utils";

const interestConfig: Record<InterestLevel, { label: string; className: string; icon: typeof Flame }> = {
  hot: {
    label: "Hot",
    className: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
    icon: Flame,
  },
  warm: {
    label: "Warm",
    className: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
    icon: Thermometer,
  },
  cold: {
    label: "Cold",
    className: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
    icon: Snowflake,
  },
};

interface InterestLevelBadgeProps {
  level: InterestLevel | null;
  showIcon?: boolean;
  className?: string;
}

export function InterestLevelBadge({ level, showIcon = true, className }: InterestLevelBadgeProps) {
  if (!level) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        Unknown
      </Badge>
    );
  }

  const config = interestConfig[level];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {config.label}
    </Badge>
  );
}
