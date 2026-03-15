"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  keywords?: string[];
  disabled?: boolean;
}

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder: string;
  triggerId?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  renderValue?: (option: ComboboxOption | undefined) => React.ReactNode;
  renderOption?: (option: ComboboxOption, selected: boolean) => React.ReactNode;
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder,
  triggerId,
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled,
  className,
  renderValue,
  renderOption,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selectedOption = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={triggerId}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">
            {renderValue ? renderValue(selectedOption) : (selectedOption?.label ?? placeholder)}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const selected = option.value === value;
                const searchKeywords = [option.label, ...(option.keywords ?? [])];

                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={searchKeywords}
                    disabled={option.disabled}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                    {renderOption ? renderOption(option, selected) : option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
