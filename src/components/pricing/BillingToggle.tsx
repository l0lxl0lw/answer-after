import { cn } from "@/lib/utils";

export type BillingPeriod = "monthly" | "yearly";

interface BillingToggleProps {
  value: BillingPeriod;
  onChange: (value: BillingPeriod) => void;
  discountPercent?: number;
}

export function BillingToggle({ value, onChange, discountPercent = 25 }: BillingToggleProps) {
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-card p-1">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={cn(
          "rounded-full px-6 py-2 text-sm font-medium transition-all",
          value === "monthly"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Pay monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("yearly")}
        className={cn(
          "rounded-full px-6 py-2 text-sm font-medium transition-all",
          value === "yearly"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Pay yearly (save {discountPercent}%)*
      </button>
    </div>
  );
}
