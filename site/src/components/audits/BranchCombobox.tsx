import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BranchComboboxProps {
  branches: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export const BranchCombobox = ({ branches, value, onChange, placeholder = "בחר סניף..." }: BranchComboboxProps) => {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => branches, [branches]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-12 text-base font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="חפש סניף..." />
          <CommandList>
            <CommandEmpty>לא נמצא סניף</CommandEmpty>
            <CommandGroup>
              {options.map((b) => (
                <CommandItem
                  key={b}
                  value={b}
                  onSelect={() => {
                    onChange(b);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("ml-2 h-4 w-4", value === b ? "opacity-100" : "opacity-0")} />
                  {b}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
