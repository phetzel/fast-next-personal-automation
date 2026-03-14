"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionContextValue {
  value: string | null;
  setValue: (value: string | null) => void;
  collapsible: boolean;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);
const AccordionItemContext = React.createContext<string | null>(null);

function useAccordionContext() {
  const context = React.useContext(AccordionContext);
  if (!context) {
    throw new Error("Accordion components must be used within <Accordion>");
  }
  return context;
}

function useAccordionItemValue() {
  const value = React.useContext(AccordionItemContext);
  if (!value) {
    throw new Error("Accordion item components must be used within <AccordionItem>");
  }
  return value;
}

interface AccordionProps {
  type?: "single";
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  collapsible?: boolean;
  className?: string;
  children: React.ReactNode;
}

function Accordion({
  value,
  defaultValue = "",
  onValueChange,
  collapsible = false,
  className,
  children,
}: AccordionProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || null);
  const currentValue = value ?? internalValue;

  const setValue = (nextValue: string | null) => {
    const resolvedValue = nextValue ?? "";
    if (onValueChange) {
      onValueChange(resolvedValue);
      return;
    }
    setInternalValue(nextValue);
  };

  return (
    <AccordionContext.Provider value={{ value: currentValue, setValue, collapsible }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function AccordionItem({ value, className, ...props }: AccordionItemProps) {
  return (
    <AccordionItemContext.Provider value={value}>
      <div className={cn("border-b", className)} {...props} />
    </AccordionItemContext.Provider>
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { value, setValue, collapsible } = useAccordionContext();
  const itemValue = useAccordionItemValue();
  const isOpen = value === itemValue;

  return (
    <button
      type="button"
      onClick={() => setValue(isOpen && collapsible ? null : itemValue)}
      className={cn("flex w-full items-center justify-between gap-3 py-4 text-left", className)}
      {...props}
    >
      <span className="flex-1">{children}</span>
      <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
    </button>
  );
}

function AccordionContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { value } = useAccordionContext();
  const itemValue = useAccordionItemValue();

  if (value !== itemValue) {
    return null;
  }

  return (
    <div className={cn("pb-4", className)} {...props}>
      {children}
    </div>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
