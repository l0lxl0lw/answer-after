import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import addCalendarImg from '@/assets/instructions/add-calendar.png';
import createCalendarImg from '@/assets/instructions/create-calendar.png';
import selectCalendarImg from '@/assets/instructions/select-calendar.png';

export default function CalendarSetupGuide() {
  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">How to Connect Google Calendar</h1>
          <p className="text-muted-foreground mt-1">
            Follow these steps to connect your Google Calendar with AnswerAfter
          </p>
        </div>

        {/* Option 1: Start Clean (Recommended) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Option 1: Start with a Fresh Calendar</CardTitle>
              <Badge variant="default" className="bg-primary">Recommended</Badge>
            </div>
            <CardDescription>
              Create a dedicated calendar for AnswerAfter appointments to keep your personal events separate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                  1
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Go to Google Calendar Settings</p>
                  <p className="text-sm text-muted-foreground">
                    Open{' '}
                    <a 
                      href="https://calendar.google.com/calendar/u/0/r/settings" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Google Calendar Settings
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                  2
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Click "Add calendar" → "Create new calendar"</p>
                  <div className="rounded-lg border overflow-hidden bg-muted/30">
                    <img 
                      src={addCalendarImg} 
                      alt="Add calendar menu showing Create new calendar option" 
                      className="w-full max-w-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                  3
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Name your calendar (e.g., "My Business" or "AnswerAfter") and click "Create calendar"</p>
                  <div className="rounded-lg border overflow-hidden bg-muted/30">
                    <img 
                      src={createCalendarImg} 
                      alt="Create new calendar form with name field" 
                      className="w-full max-w-md"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                  4
                </div>
                <div className="space-y-2">
                  <p className="font-medium">When connecting in AnswerAfter, select the calendar you just created</p>
                  <div className="rounded-lg border overflow-hidden bg-muted/30">
                    <img 
                      src={selectCalendarImg} 
                      alt="Calendar selection screen in AnswerAfter" 
                      className="w-full max-w-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Option 2: Use Existing Calendar */}
        <Card>
          <CardHeader>
            <CardTitle>Option 2: Use Your Existing Calendar</CardTitle>
            <CardDescription>
              If you prefer to use a calendar you already have, simply select it during the connection process
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-semibold">
                1
              </div>
              <div className="space-y-2">
                <p className="font-medium">Click "Connect" on the Integrations page</p>
                <p className="text-sm text-muted-foreground">
                  You'll be redirected to Google to authorize AnswerAfter
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-semibold">
                2
              </div>
              <div className="space-y-2">
                <p className="font-medium">Select your existing calendar from the list</p>
                <p className="text-sm text-muted-foreground">
                  Choose whichever calendar you want AnswerAfter to use for scheduling appointments
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>Note:</strong> AnswerAfter will only read availability and create new events on your selected calendar. We cannot access other calendars, modify existing events, or view personal/sensitive data.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
