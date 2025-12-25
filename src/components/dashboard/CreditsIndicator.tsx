import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSubscription } from "@/hooks/use-api";
import { useTotalAvailableCredits, useCreateCreditTopup } from "@/hooks/use-credits";
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
import { Settings, CreditCard, LogOut, Palette, ChevronRight, Monitor, Moon, Sun, Check, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

type ThemeMode = 'system' | 'dark' | 'light';

function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as ThemeMode) || 'system';
    }
    return 'system';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}

interface CreditsIndicatorProps {
  collapsed?: boolean;
  organizationName?: string;
  onClose?: () => void;
}

export function CreditsIndicator({ collapsed, organizationName, onClose }: CreditsIndicatorProps) {
  const { data: subscription } = useSubscription();
  const { purchasedCredits } = useTotalAvailableCredits();
  const createTopup = useCreateCreditTopup();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const totalCredits = subscription?.total_credits ?? 1000;
  const usedCredits = subscription?.used_credits ?? 0;
  const subscriptionRemaining = totalCredits - usedCredits;
  const remainingCredits = subscriptionRemaining + purchasedCredits;
  const percentageUsed = totalCredits > 0 ? (usedCredits / totalCredits) * 100 : 0;
  const percentageRemaining = 100 - percentageUsed;
  
  // Warning thresholds
  const isLowBalance = percentageRemaining <= 25;
  const isCriticalBalance = percentageRemaining <= 10;

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

  const handleTopup = async () => {
    const result = await createTopup.mutateAsync();
    if (result?.url) {
      window.location.href = result.url;
    }
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
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CircularProgress />
              <span className="font-medium">Balance</span>
            </div>
            <div className="flex gap-1">
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 text-xs px-2"
                onClick={handleTopup}
                disabled={createTopup.isPending}
              >
                {createTopup.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-3 h-3 mr-1" />
                    Top Up
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm pl-12">
            <span className="text-muted-foreground">Plan credits</span>
            <span className={cn(
              "text-right font-medium",
              isCriticalBalance && "text-destructive",
              isLowBalance && !isCriticalBalance && "text-warning"
            )}>
              {subscriptionRemaining.toLocaleString()}
            </span>
            {purchasedCredits > 0 && (
              <>
                <span className="text-muted-foreground">Purchased</span>
                <span className="text-right font-medium text-success">+{purchasedCredits.toLocaleString()}</span>
              </>
            )}
            <span className="text-muted-foreground font-medium">Total</span>
            <span className="text-right font-semibold">{remainingCredits.toLocaleString()}</span>
          </div>
          {isLowBalance && (
            <p className={cn(
              "text-xs pl-12",
              isCriticalBalance ? "text-destructive" : "text-warning"
            )}>
              {isCriticalBalance ? "Credits running low!" : "Consider upgrading or topping up"}
            </p>
          )}
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
          
          {/* Appearance Section - Submenu */}
          <div className="relative">
            <button
              onMouseEnter={() => setAppearanceOpen(true)}
              onMouseLeave={() => setAppearanceOpen(false)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Palette className="w-4 h-4" />
                Appearance
              </div>
              <ChevronRight className="w-4 h-4" />
            </button>
            {appearanceOpen && (
              <div
                onMouseEnter={() => setAppearanceOpen(true)}
                onMouseLeave={() => setAppearanceOpen(false)}
                className="absolute left-full top-0 ml-1 w-40 bg-popover border border-border rounded-lg shadow-lg p-1 z-50"
              >
                <button
                  onClick={() => { setTheme('system'); setAppearanceOpen(false); }}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Monitor className="w-4 h-4" />
                    System
                  </div>
                  {theme === 'system' && <Check className="w-4 h-4 text-primary" />}
                </button>
                <button
                  onClick={() => { setTheme('dark'); setAppearanceOpen(false); }}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Moon className="w-4 h-4" />
                    Dark
                  </div>
                  {theme === 'dark' && <Check className="w-4 h-4 text-primary" />}
                </button>
                <button
                  onClick={() => { setTheme('light'); setAppearanceOpen(false); }}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Sun className="w-4 h-4" />
                    Light
                  </div>
                  {theme === 'light' && <Check className="w-4 h-4 text-primary" />}
                </button>
              </div>
            )}
          </div>
          
          <Link
            to="/dashboard/subscriptions"
            onClick={handleMenuItemClick}
            className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            View Plans
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
