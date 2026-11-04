import { useId } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** One app-native selector shared by every educational form and language. */
export function EduSelect({
  value,
  onChange,
  options,
  label,
  placeholder,
  disabled = false,
  required = false,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      required={required}
      name={id}
    >
      <SelectTrigger
        aria-label={label}
        className={`h-11 min-w-0 border-2 bg-background font-bold ${className}`}
      >
        <SelectValue placeholder={placeholder ?? label} />
      </SelectTrigger>
      <SelectContent className="border-2 font-bold">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="min-h-10 cursor-pointer">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
