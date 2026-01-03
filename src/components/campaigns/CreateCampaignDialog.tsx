import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useCreateCampaign } from '@/hooks/use-campaigns';
import { useCustomers } from '@/hooks/use-contacts';
import { Loader2, Users, ChevronRight, ChevronLeft } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAYS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
];

export function CreateCampaignDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createCampaign = useCreateCampaign();
  const { data: customersData } = useCustomers({}, 1, 100);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    agent_prompt: '',
    first_message: '',
    calling_hours_start: '09:00',
    calling_hours_end: '17:00',
    calling_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    max_attempts: 3,
  });
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  const contacts = customersData?.contacts || [];

  const handleClose = () => {
    setStep(1);
    setFormData({
      name: '',
      description: '',
      agent_prompt: '',
      first_message: '',
      calling_hours_start: '09:00',
      calling_hours_end: '17:00',
      calling_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      max_attempts: 3,
    });
    setSelectedContacts([]);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Campaign name is required', variant: 'destructive' });
      return;
    }

    try {
      const campaign = await createCampaign.mutateAsync({
        ...formData,
        contact_ids: selectedContacts,
      });

      toast({ title: 'Campaign created successfully' });
      handleClose();
      navigate(`/dashboard/campaigns/${campaign.id}`);
    } catch (error) {
      toast({ title: 'Failed to create campaign', variant: 'destructive' });
    }
  };

  const toggleContact = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const toggleAllContacts = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      calling_days: prev.calling_days.includes(day)
        ? prev.calling_days.filter(d => d !== day)
        : [...prev.calling_days, day],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
          <DialogDescription>
            Step {step} of 3: {step === 1 ? 'Basic Info' : step === 2 ? 'Select Contacts' : 'Schedule'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Follow-up Calls - January"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of this campaign"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="first_message">First Message</Label>
              <Textarea
                id="first_message"
                placeholder="Hi, this is [Business Name] calling to follow up..."
                value={formData.first_message}
                onChange={e => setFormData({ ...formData, first_message: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                The initial message the AI will say when the call connects.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent_prompt">Additional Instructions (optional)</Label>
              <Textarea
                id="agent_prompt"
                placeholder="Specific instructions for how the AI should handle these calls..."
                value={formData.agent_prompt}
                onChange={e => setFormData({ ...formData, agent_prompt: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Step 2: Select Contacts */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedContacts.length} of {contacts.length} contacts selected
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAllContacts}
              >
                {selectedContacts.length === contacts.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            {contacts.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No contacts available</p>
                <p className="text-sm text-muted-foreground">
                  Add contacts first or import from CSV
                </p>
              </div>
            ) : (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {contacts.map(contact => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                  >
                    <Checkbox
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {contact.name || 'Unknown'}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {contact.phone}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              You can add more contacts after creating the campaign.
            </p>
          </div>
        )}

        {/* Step 3: Schedule */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Calling Hours</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={formData.calling_hours_start}
                  onChange={e => setFormData({ ...formData, calling_hours_start: e.target.value })}
                  className="w-32"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={formData.calling_hours_end}
                  onChange={e => setFormData({ ...formData, calling_hours_end: e.target.value })}
                  className="w-32"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Calling Days</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(day => (
                  <Button
                    key={day.value}
                    variant={formData.calling_days.includes(day.value) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleDay(day.value)}
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_attempts">Maximum Call Attempts</Label>
              <Input
                id="max_attempts"
                type="number"
                min={1}
                max={10}
                value={formData.max_attempts}
                onChange={e => setFormData({ ...formData, max_attempts: parseInt(e.target.value) || 3 })}
                className="w-24"
              />
              <p className="text-xs text-muted-foreground">
                Number of times to attempt calling each contact if they don't answer.
              </p>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <h4 className="font-medium">Campaign Summary</h4>
              <p className="text-sm text-muted-foreground">
                <strong>{formData.name || 'Unnamed campaign'}</strong> with{' '}
                <strong>{selectedContacts.length} contacts</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Calls will be made {formData.calling_days.join(', ')} between{' '}
                {formData.calling_hours_start} and {formData.calling_hours_end}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep(s => s + 1)}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={createCampaign.isPending}>
              {createCampaign.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Campaign
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
