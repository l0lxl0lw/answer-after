import { useState } from "react";
import { Link } from "react-router-dom";
import { useSubscription } from "@/hooks/use-api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Settings, CreditCard, Sparkles, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface CreditsIndicatorProps {
  collapsed?: boolean;
  organizationName?: string;
  onClose?: () => void;
}

export function CreditsIndicator({ collapsed, organizationName, onClose }: CreditsIndicatorProps) {
  const { data: subscription } = useSubscription();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const totalCredits = subscription?.total_credits ?? 1000;
  const usedCredits = subscription?.used_credits ?? 0;
  const remainingCredits = totalCredits - usedCredits;
  const percentageUsed = totalCredits > 0 ? (usedCredits / totalCredits) * 100 : 0;
  const percentageRemaining = 100 - percentageUsed;

  // SVG circle calculations
  const size = 40;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentageRemaining / 100) * circumference;

  const handleLogout = async () => {
    setOpen(false);
    onClose?.();
    await logout();
    navigate('/');
  };

  const handleMenuItemClick = () => {
    setOpen(false);
    onClose?.();
  };

  const CircularProgress = () => (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn(
            "transition-all duration-500",
            percentageRemaining > 50 ? "text-success" : 
            percentageRemaining > 20 ? "text-warning" : "text-destructive"
          )}
        />
      </svg>
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-medium text-foreground">
          {Math.round(percentageRemaining)}%
        </span>
      </div>
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-3 w-full p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors cursor-pointer",
                  collapsed && "justify-center"
                )}
              >
                <CircularProgress />
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{organizationName || 'My Workspace'}</p>
                  </div>
                )}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {remainingCredits.toLocaleString()} credits remaining ({Math.round(percentageRemaining)}%)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent 
        side={collapsed ? "right" : "top"} 
        align="start" 
        className="w-64 p-0"
        sideOffset={8}
      >
        {/* Balance Section */}
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CircularProgress />
              <span className="font-medium">Balance</span>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
              <Link to="/dashboard/settings" onClick={handleMenuItemClick}>
                Upgrade
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 text-sm pl-12">
            <span className="text-muted-foreground">Total</span>
            <span className="text-right font-medium">{totalCredits.toLocaleString()} credits</span>
            <span className="text-muted-foreground">Remaining</span>
            <span className="text-right font-medium">{remainingCredits.toLocaleString()}</span>
          </div>
        </div>

        <Separator />

        {/* Menu Items */}
        <div className="p-2">
          <Link
            to="/dashboard/settings"
            onClick={handleMenuItemClick}
            className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
          <Link
            to="/#pricing"
            onClick={handleMenuItemClick}
            className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            View Pricing
          </Link>
        </div>

        <Separator />

        {/* Sign Out */}
        <div className="p-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
