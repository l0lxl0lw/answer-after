import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  useCampaigns,
  useUpdateCampaignStatus,
  useDeleteCampaign,
  type Campaign,
  type CampaignStatus,
} from '@/hooks/use-campaigns';
import {
  Plus,
  Megaphone,
  MoreHorizontal,
  Play,
  Pause,
  CheckCircle,
  Trash2,
  Users,
  Phone,
  PhoneCall,
  Target,
  Eye,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CreateCampaignDialog } from '@/components/campaigns/CreateCampaignDialog';

const statusConfig: Record<CampaignStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  paused: { label: 'Paused', variant: 'outline' },
  completed: { label: 'Completed', variant: 'secondary' },
};

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { toast } = useToast();
  const updateStatus = useUpdateCampaignStatus();
  const deleteCampaign = useDeleteCampaign();

  const handleStatusChange = async (status: CampaignStatus) => {
    try {
      await updateStatus.mutateAsync({ id: campaign.id, status });
      toast({
        title: 'Campaign updated',
        description: `Campaign is now ${status}`,
      });
    } catch (error) {
      toast({
        title: 'Failed to update campaign',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    try {
      await deleteCampaign.mutateAsync(campaign.id);
      toast({ title: 'Campaign deleted' });
    } catch (error) {
      toast({
        title: 'Failed to delete campaign',
        variant: 'destructive',
      });
    }
  };

  const completionRate = campaign.total_contacts > 0
    ? Math.round((campaign.contacts_completed / campaign.total_contacts) * 100)
    : 0;

  const connectionRate = campaign.contacts_called > 0
    ? Math.round((campaign.contacts_connected / campaign.contacts_called) * 100)
    : 0;

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{campaign.name}</CardTitle>
            {campaign.description && (
              <CardDescription className="line-clamp-2">
                {campaign.description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusConfig[campaign.status].variant}>
              {statusConfig[campaign.status].label}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/dashboard/campaigns/${campaign.id}`}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {campaign.status === 'draft' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                    <Play className="w-4 h-4 mr-2" />
                    Start Campaign
                  </DropdownMenuItem>
                )}
                {campaign.status === 'active' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('paused')}>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause Campaign
                  </DropdownMenuItem>
                )}
                {campaign.status === 'paused' && (
                  <>
                    <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                      <Play className="w-4 h-4 mr-2" />
                      Resume Campaign
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('completed')}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark Complete
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Users className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-semibold">{campaign.total_contacts}</p>
            <p className="text-xs text-muted-foreground">Contacts</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Phone className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-semibold">{campaign.contacts_called}</p>
            <p className="text-xs text-muted-foreground">Called</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <PhoneCall className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-semibold">{campaign.contacts_connected}</p>
            <p className="text-xs text-muted-foreground">Connected</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Target className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-semibold">{campaign.contacts_completed}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
        </div>

        {/* Progress */}
        {campaign.total_contacts > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{completionRate}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            {connectionRate > 0 && (
              <p className="text-xs text-muted-foreground">
                {connectionRate}% connection rate
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t text-sm text-muted-foreground">
          <span>
            Created {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
          </span>
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/dashboard/campaigns/${campaign.id}`}>
              View Details
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Campaigns() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: campaigns, isLoading } = useCampaigns();

  const activeCampaigns = campaigns?.filter(c => c.status === 'active') || [];
  const draftCampaigns = campaigns?.filter(c => c.status === 'draft') || [];
  const completedCampaigns = campaigns?.filter(c => c.status === 'completed' || c.status === 'paused') || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
            <p className="text-muted-foreground">
              Create and manage outbound calling campaigns
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!campaigns || campaigns.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Megaphone className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Create your first outbound campaign to start reaching out to contacts automatically.
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Active Campaigns */}
        {activeCampaigns.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Active Campaigns
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeCampaigns.map(campaign => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Draft Campaigns */}
        {draftCampaigns.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-lg font-semibold mb-3">Drafts</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {draftCampaigns.map(campaign => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Completed Campaigns */}
        {completedCampaigns.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-lg font-semibold mb-3">Completed & Paused</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedCampaigns.map(campaign => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <CreateCampaignDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </DashboardLayout>
  );
}
