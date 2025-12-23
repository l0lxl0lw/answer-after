import { useState, useEffect } from "react";
import { useOrganization } from "@/hooks/use-api";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Phone,
  LayoutDashboard,
  Calendar,
  PhoneCall,
  Settings,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Menu,
  Sparkles,
  Shield,
  Puzzle,
  Bot,
  ChevronDown,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreditsIndicator } from "./CreditsIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Organized sidebar sections
const sidebarSections = [
  {
    label: null, // No label for top section
    links: [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Configure",
    links: [
      { name: "My Agent", href: "/dashboard/my-agent", icon: Bot },
      { name: "Integrations", href: "/dashboard/integrations", icon: Puzzle },
    ],
  },
  {
    label: "Monitor",
    links: [
      { name: "Calls", href: "/dashboard/calls", icon: PhoneCall },
      { name: "Appointments", href: "/dashboard/appointments", icon: Calendar },
    ],
  },
  {
    label: "Manage",
    links: [
      { name: "Schedules", href: "/dashboard/schedules", icon: Wrench },
      { name: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-card border-b border-border flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-hero">
            <Phone className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg">AnswerAfter</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-foreground"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-sidebar border-r border-sidebar-border p-4"
            >
              <SidebarContent
                collapsed={false}
                currentPath={location.pathname}
                onClose={() => setMobileOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 80 : 280 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 bg-sidebar border-r border-sidebar-border flex-col p-4"
      >
        <SidebarContent
          collapsed={collapsed}
          currentPath={location.pathname}
        />
        
        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center shadow-md hover:bg-muted transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </motion.aside>

      {/* Main Content */}
      <main
        className={cn(
          "min-h-screen pt-16 lg:pt-0 transition-all duration-300",
          collapsed ? "lg:pl-20" : "lg:pl-[280px]"
        )}
      >
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

interface SidebarContentProps {
  collapsed: boolean;
  currentPath: string;
  onClose?: () => void;
}

function SidebarContent({ collapsed, currentPath, onClose }: SidebarContentProps) {
  const { data: organization } = useOrganization();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'inbound' | 'outbound'>('inbound');
  
  // Check if user is admin
  useEffect(() => {
    async function checkAdminRole() {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) {
        setIsAdmin(false);
        return;
      }

      const roles = data?.map((r) => r.role) || [];
      setIsAdmin(roles.includes("admin") || roles.includes("owner"));
    }

    checkAdminRole();
  }, [user]);
  
  return (
    <>
      {/* Logo & Mode Dropdown */}
      <div className="mb-6">
        <Link
          to="/"
          className={cn(
            "flex items-center gap-3 mb-4",
            collapsed && "justify-center"
          )}
          onClick={onClose}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-hero shadow-glow flex-shrink-0">
            <Phone className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-display font-bold text-lg">
              Answer<span className="text-gradient">After</span>
            </span>
          )}
        </Link>

        {/* Inbound/Outbound Mode Dropdown */}
        {!collapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors text-sm">
                <div className="flex items-center gap-2">
                  {selectedMode === 'inbound' ? (
                    <PhoneIncoming className="w-4 h-4 text-primary" />
                  ) : (
                    <PhoneOutgoing className="w-4 h-4 text-primary" />
                  )}
                  <span className="font-medium">
                    {selectedMode === 'inbound' ? 'Inbound' : 'Outbound'}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 bg-popover border border-border shadow-lg">
              <DropdownMenuItem 
                onClick={() => setSelectedMode('inbound')}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <PhoneIncoming className="w-4 h-4" />
                  Inbound
                </div>
                {selectedMode === 'inbound' && <Check className="w-4 h-4 text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSelectedMode('outbound')}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <PhoneOutgoing className="w-4 h-4" />
                  Outbound
                </div>
                {selectedMode === 'outbound' && <Check className="w-4 h-4 text-primary" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Collapsed mode indicator */}
        {collapsed && (
          <div className="flex justify-center">
            {selectedMode === 'inbound' ? (
              <PhoneIncoming className="w-5 h-5 text-primary" />
            ) : (
              <PhoneOutgoing className="w-5 h-5 text-primary" />
            )}
          </div>
        )}
      </div>

      {/* Navigation - Show based on selected mode */}
      {selectedMode === 'inbound' ? (
        <nav className="flex-1 space-y-4 overflow-y-auto">
          {sidebarSections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {/* Section Label */}
              {section.label && !collapsed && (
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {section.label}
                </div>
              )}
              
              {/* Section Links */}
              <div className="space-y-1">
                {section.links.map((link) => {
                  const isActive = currentPath === link.href;
                  return (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                        collapsed && "justify-center px-2",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <link.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-primary")} />
                      {!collapsed && <span>{link.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          
          {/* Admin Link - only visible to admins */}
          {isAdmin && (
            <div>
              {!collapsed && (
                <div className="px-3 py-1.5 text-xs font-medium text-destructive/70 uppercase tracking-wider">
                  Admin
                </div>
              )}
              <Link
                to="/dashboard/admin"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  collapsed && "justify-center px-2",
                  currentPath === "/dashboard/admin"
                    ? "bg-destructive/10 text-destructive font-medium"
                    : "text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                )}
              >
                <Shield className={cn("w-5 h-5 flex-shrink-0")} />
                {!collapsed && <span>Admin Panel</span>}
              </Link>
            </div>
          )}
        </nav>
      ) : (
        /* Outbound Coming Soon */
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          {!collapsed ? (
            <>
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Coming Soon</h3>
              <p className="text-sm text-muted-foreground">
                Outbound calling features are currently in development.
              </p>
            </>
          ) : (
            <Clock className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
      )}

      {/* Upgrade Button & User Section */}
      <div className={cn(
        "pt-4 border-t border-sidebar-border mt-4 space-y-3",
        collapsed && "flex flex-col items-center"
      )}>
        {/* Upgrade Button */}
        <Button
          variant="outline"
          size={collapsed ? "icon" : "sm"}
          className={cn(
            "w-full gap-2",
            collapsed && "w-10"
          )}
          asChild
        >
          <Link to="/dashboard/subscriptions" onClick={onClose}>
            <Sparkles className="w-4 h-4" />
            {!collapsed && <span>Upgrade</span>}
          </Link>
        </Button>

        {/* Credits Indicator with Menu */}
        <CreditsIndicator 
          collapsed={collapsed} 
          organizationName={organization?.name}
          onClose={onClose}
        />
      </div>
    </>
  );
}
