import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRoles } from "@/hooks/use-roles";
import { cn } from "@/lib/utils";

interface RoleMultiSelectProps {
  value: string[]; // Array of role slugs (matches services.provider_roles TEXT[])
  onChange: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function RoleMultiSelect({
  value,
  onChange,
  disabled,
  placeholder = "Select roles...",
}: RoleMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const { data: roles = [], isLoading } = useRoles();

  const toggleRole = (slug: string) => {
    if (value.includes(slug)) {
      onChange(value.filter((v) => v !== slug));
    } else {
      onChange([...value, slug]);
    }
  };

  const removeRole = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== slug));
  };

  // Map slugs to role names for display
  const selectedRoles = roles.filter((r) => value.includes(r.slug));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-auto min-h-10",
            !value.length && "text-muted-foreground"
          )}
          disabled={disabled || isLoading}
        >
          <div className="flex flex-wrap gap-1 py-0.5">
            {selectedRoles.length > 0 ? (
              selectedRoles.map((role) => (
                <Badge
                  key={role.slug}
                  variant="secondary"
                  className="mr-1 pr-1"
                >
                  {role.name}
                  <button
                    type="button"
                    className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-muted"
                    onClick={(e) => removeRole(role.slug, e)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            ) : (
              <span>{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search roles..." />
          <CommandList>
            <CommandEmpty>No roles found.</CommandEmpty>
            <CommandGroup>
              {roles.map((role) => (
                <CommandItem
                  key={role.id}
                  value={role.name}
                  onSelect={() => toggleRole(role.slug)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.includes(role.slug) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {role.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
