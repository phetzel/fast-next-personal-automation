"use client";

import { useState, useCallback } from "react";
import { Input, Label, Button } from "@/components/ui";
import type { JSONSchema, JSONSchemaProperty } from "@/types";
import { cn } from "@/lib/utils";
import { ProfileSelectField } from "./profile-select-field";
import { JobSelectField } from "./job-select-field";

interface DynamicFormProps {
  schema: JSONSchema;
  onSubmit: (data: Record<string, unknown>) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  /** Initial values to pre-fill the form */
  initialValues?: Record<string, unknown>;
}

/**
 * Renders a form dynamically based on JSON Schema.
 * Supports string, number, integer, boolean, and enum types.
 */
export function DynamicForm({
  schema,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Run",
  initialValues,
}: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    // Initialize with default values from schema
    const defaults: Record<string, unknown> = {};
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        // Use initial value if provided, otherwise use schema default
        if (initialValues && initialValues[key] !== undefined) {
          defaults[key] = initialValues[key];
        } else if (prop.default !== undefined) {
          defaults[key] = prop.default;
        } else if (prop.type === "boolean") {
          defaults[key] = false;
        } else if (prop.type === "number" || prop.type === "integer") {
          defaults[key] = prop.minimum ?? 0;
        } else if (prop.type === "string") {
          defaults[key] = "";
        }
      }
    }
    return defaults;
  });

  const handleChange = useCallback((key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const requiredFields = new Set(schema.required || []);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {schema.properties &&
        Object.entries(schema.properties)
          .filter(([, prop]) => !prop["x-hidden"]) // Skip hidden fields
          .map(([key, prop]) => (
            <FormField
              key={key}
              name={key}
              property={prop}
              value={formData[key]}
              onChange={(value) => handleChange(key, value)}
              required={requiredFields.has(key)}
            />
          ))}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Running..." : submitLabel}
      </Button>
    </form>
  );
}

interface FormFieldProps {
  name: string;
  property: JSONSchemaProperty;
  value: unknown;
  onChange: (value: unknown) => void;
  required?: boolean;
}

function FormField({ name, property, value, onChange, required }: FormFieldProps) {
  const id = `field-${name}`;
  const description = property.description;

  // Handle custom x-profile-select format for profile selection
  if (property.format === "x-profile-select") {
    return (
      <ProfileSelectField
        id={id}
        value={value}
        onChange={(v) => onChange(v)}
        required={required}
        description={description}
      />
    );
  }

  // Handle custom x-job-select format for job selection
  if (property.format === "x-job-select") {
    return (
      <JobSelectField
        id={id}
        value={value}
        onChange={(v) => onChange(v)}
        required={required}
        description={description}
      />
    );
  }

  // Handle enum (select dropdown)
  if (property.enum && property.enum.length > 0) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          {formatLabel(name)}
          {required && <span className="text-destructive">*</span>}
        </Label>
        <select
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={cn(
            "border-input bg-background ring-offset-background",
            "focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2",
            "text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <option value="">Select...</option>
          {property.enum.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
    );
  }

  // Handle boolean (checkbox)
  if (property.type === "boolean") {
    return (
      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id={id}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className={cn(
            "border-primary ring-offset-background focus-visible:ring-ring",
            "h-4 w-4 shrink-0 rounded border",
            "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          )}
        />
        <div className="space-y-0.5">
          <Label htmlFor={id} className="cursor-pointer">
            {formatLabel(name)}
          </Label>
          {description && <p className="text-muted-foreground text-xs">{description}</p>}
        </div>
      </div>
    );
  }

  // Handle number/integer
  if (property.type === "number" || property.type === "integer") {
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          {formatLabel(name)}
          {required && <span className="text-destructive">*</span>}
        </Label>
        <Input
          type="number"
          id={id}
          value={value !== undefined ? String(value) : ""}
          onChange={(e) => {
            const num =
              property.type === "integer"
                ? parseInt(e.target.value, 10)
                : parseFloat(e.target.value);
            onChange(isNaN(num) ? undefined : num);
          }}
          required={required}
          min={property.minimum}
          max={property.maximum}
          step={property.type === "integer" ? 1 : "any"}
        />
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
    );
  }

  // Handle string (default)
  const inputType = getInputType(property);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        {formatLabel(name)}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        type={inputType}
        id={id}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={property.minLength}
        maxLength={property.maxLength}
        placeholder={description}
      />
      {description && inputType !== "text" && (
        <p className="text-muted-foreground text-xs">{description}</p>
      )}
    </div>
  );
}

/**
 * Convert snake_case or camelCase to Title Case.
 */
function formatLabel(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get HTML input type based on JSON Schema format.
 */
function getInputType(property: JSONSchemaProperty): string {
  if (property.format === "email") return "email";
  if (property.format === "date") return "date";
  if (property.format === "date-time") return "datetime-local";
  if (property.format === "uri") return "url";
  return "text";
}
