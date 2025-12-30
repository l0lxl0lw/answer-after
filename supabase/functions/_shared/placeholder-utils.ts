/**
 * Prompt Template Placeholder Utilities
 *
 * Shared logic for placeholder definitions, value building, and replacement.
 * Used by both admin-prompt-templates (preview) and elevenlabs-agent (actual prompts).
 */

export interface PlaceholderDefinition {
  key: string;
  placeholder: string;
  description: string;
  example: string;
  category: 'basic' | 'hours' | 'services' | 'custom';
}

export interface PlaceholderValues {
  orgName: string;
  businessHoursStart: string;
  businessHoursEnd: string;
  businessDays: string;
  timezone: string;
  services: string;
  customInstructions: string;
}

export interface OrganizationData {
  id?: string;
  name: string;
  timezone?: string;
  business_hours_start?: string;
  business_hours_end?: string;
  business_hours_schedule?: WeekSchedule;
}

export interface ServiceData {
  name: string;
  price_cents: number;
  duration_minutes: number;
}

export interface AgentContextData {
  context?: string;
}

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

interface WeekSchedule {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

/**
 * All available placeholder definitions with descriptions and examples
 */
export const PLACEHOLDER_DEFINITIONS: PlaceholderDefinition[] = [
  {
    key: 'orgName',
    placeholder: '{{orgName}}',
    description: 'Organization name',
    example: 'ABC Plumbing',
    category: 'basic',
  },
  {
    key: 'timezone',
    placeholder: '{{timezone}}',
    description: 'Business timezone',
    example: 'America/New_York',
    category: 'basic',
  },
  {
    key: 'businessHoursStart',
    placeholder: '{{businessHoursStart}}',
    description: 'Business opening time',
    example: '8:00 AM',
    category: 'hours',
  },
  {
    key: 'businessHoursEnd',
    placeholder: '{{businessHoursEnd}}',
    description: 'Business closing time',
    example: '5:00 PM',
    category: 'hours',
  },
  {
    key: 'businessDays',
    placeholder: '{{businessDays}}',
    description: 'Days the business is open (formatted naturally)',
    example: 'Monday through Friday',
    category: 'hours',
  },
  {
    key: 'services',
    placeholder: '{{services}}',
    description: 'Formatted list of services with prices and durations',
    example: '- Drain Cleaning: $150 (60 min)\n- Water Heater Repair: $200 (90 min)',
    category: 'services',
  },
  {
    key: 'customInstructions',
    placeholder: '{{customInstructions}}',
    description: 'Custom business instructions from agent setup',
    example: 'We specialize in emergency plumbing services and offer 24/7 support.',
    category: 'custom',
  },
];

/**
 * Helper to capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format business days from schedule into natural language
 * Examples: "Monday through Friday", "Every day", "Monday, Wednesday, and Friday"
 */
export function formatBusinessDays(schedule: WeekSchedule | null | undefined): string {
  if (!schedule) return 'Monday through Friday';

  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const enabledDays = dayOrder.filter(day => schedule[day]?.enabled);

  if (enabledDays.length === 0) return 'By appointment only';
  if (enabledDays.length === 7) return 'Every day';

  // Check for standard weekdays only
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
  const weekends = ['saturday', 'sunday'] as const;

  const allWeekdaysEnabled = weekdays.every(d => enabledDays.includes(d));
  const noWeekendsEnabled = !weekends.some(d => enabledDays.includes(d));

  if (allWeekdaysEnabled && noWeekendsEnabled) {
    return 'Monday through Friday';
  }

  // Check for weekdays + Saturday
  const allWeekdaysPlusSat = allWeekdaysEnabled && enabledDays.includes('saturday') && !enabledDays.includes('sunday');
  if (allWeekdaysPlusSat) {
    return 'Monday through Saturday';
  }

  // Format as ranges for consecutive days
  return formatDayRanges(enabledDays);
}

/**
 * Format an array of enabled days into ranges
 * Example: ['monday', 'tuesday', 'wednesday', 'friday'] => "Monday through Wednesday and Friday"
 */
function formatDayRanges(enabledDays: string[]): string {
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const sorted = [...enabledDays].sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));

  // Find consecutive ranges
  const ranges: string[][] = [];
  let currentRange: string[] = [];

  for (const day of sorted) {
    const prevDay = currentRange[currentRange.length - 1];
    if (!prevDay || dayOrder.indexOf(day) === dayOrder.indexOf(prevDay) + 1) {
      currentRange.push(day);
    } else {
      if (currentRange.length > 0) ranges.push(currentRange);
      currentRange = [day];
    }
  }
  if (currentRange.length > 0) ranges.push(currentRange);

  // Format each range
  const formatted = ranges.map(range => {
    if (range.length === 1) return capitalize(range[0]);
    if (range.length === 2) return `${capitalize(range[0])} and ${capitalize(range[1])}`;
    return `${capitalize(range[0])} through ${capitalize(range[range.length - 1])}`;
  });

  // Join ranges
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;
  return formatted.slice(0, -1).join(', ') + ', and ' + formatted[formatted.length - 1];
}

/**
 * Format services list with prices and durations
 * Example output:
 * - Drain Cleaning: $150 (60 min)
 * - Water Heater Repair: $200 (90 min)
 */
export function formatServicesList(services: ServiceData[] | null | undefined): string {
  if (!services || services.length === 0) {
    return 'Services available upon request';
  }

  return services.map(service => {
    const price = service.price_cents > 0
      ? `$${Math.floor(service.price_cents / 100)}`
      : 'Quote on request';
    const duration = service.duration_minutes > 0
      ? `${service.duration_minutes} min`
      : 'Varies';
    return `- ${service.name}: ${price} (${duration})`;
  }).join('\n');
}

/**
 * Extract custom instructions from agent context JSON
 */
function extractCustomInstructions(agentContext: AgentContextData | null | undefined): string {
  if (!agentContext?.context) return '';

  try {
    const parsed = JSON.parse(agentContext.context);
    // Support both 'customInstructions' and 'content' field names
    return parsed.customInstructions || parsed.content || '';
  } catch {
    // If not valid JSON, treat the whole context as custom instructions
    return agentContext.context || '';
  }
}

/**
 * Build all placeholder values from organization data, services, and agent context
 */
export function buildPlaceholderValues(
  org: OrganizationData | null | undefined,
  services: ServiceData[] | null | undefined,
  agentContext: AgentContextData | null | undefined
): PlaceholderValues {
  return {
    orgName: org?.name || 'Your Business',
    timezone: org?.timezone || 'America/New_York',
    businessHoursStart: org?.business_hours_start || '8:00 AM',
    businessHoursEnd: org?.business_hours_end || '5:00 PM',
    businessDays: formatBusinessDays(org?.business_hours_schedule),
    services: formatServicesList(services),
    customInstructions: extractCustomInstructions(agentContext),
  };
}

/**
 * Replace all placeholders in a template with their values
 */
export function replacePlaceholders(template: string, values: PlaceholderValues): string {
  return template
    .replace(/\{\{orgName\}\}/g, values.orgName)
    .replace(/\{\{timezone\}\}/g, values.timezone)
    .replace(/\{\{businessHoursStart\}\}/g, values.businessHoursStart)
    .replace(/\{\{businessHoursEnd\}\}/g, values.businessHoursEnd)
    .replace(/\{\{businessDays\}\}/g, values.businessDays)
    .replace(/\{\{services\}\}/g, values.services)
    .replace(/\{\{customInstructions\}\}/g, values.customInstructions);
}
