import type { ZodSchema } from "zod";

export type FieldType =
  | "text"
  | "email"
  | "password"
  | "tel"
  | "number"
  | "select"
  | "searchable-select"
  | "textarea"
  | "checkbox"
  | "file"
  | "date";

export interface FormOption {
  label: string;
  value: string;
}

export interface FormOptionGroup {
  label: string;
  options: FormOption[];
}

export interface SearchableFormOption extends FormOption {
  description?: string;
  meta?: string;
  keywords?: string[];
  badge?: string;
  disabled?: boolean;
}

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  section?: string;
  placeholder?: string;
  required?: boolean;
  options?: FormOption[]; // For select type
  groups?: FormOptionGroup[]; // For grouped select type
  searchableOptions?: SearchableFormOption[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  clearable?: boolean;
  clearLabel?: string;
  rows?: number; // For textarea type
  icon?: React.ReactNode;
  helperText?: string;
  // Optional UI behavior hooks
  disabled?: boolean;
  onChange?: (value: string) => void;
  resetFields?: string[];
}

export interface DynamicModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  fields: FormField[];
  initialData?: Record<string, string | number | boolean | File>;
  schema?: ZodSchema;
  onSubmit: (
    data: Record<string, string | number | boolean | File>,
  ) => Promise<void> | void;
  variant?: "light" | "dark";

  submitLabel?: string;
}
