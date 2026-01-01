import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface LeadNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialNotes: string;
  onSave: (notes: string) => Promise<void>;
  callerName?: string | null;
}

export function LeadNotesDialog({
  open,
  onOpenChange,
  initialNotes,
  onSave,
  callerName,
}: LeadNotesDialogProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(notes);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Lead Notes</DialogTitle>
          <DialogDescription>
            {callerName ? `Notes for ${callerName}` : "Add notes about this lead"}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="Enter notes about this lead..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[150px] resize-y"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Notes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
