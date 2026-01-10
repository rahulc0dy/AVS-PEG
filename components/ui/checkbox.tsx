import React, { forwardRef } from "react";

interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  label?: string;
}

/**
 * Small, accessible checkbox built on a native <input type="checkbox" />.
 * Kept minimal to match the project's lightweight UI components.
 */
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = "", label, ...props }, ref) => {
    return (
      <label className={`inline-flex items-center gap-2 ${className}`}>
        <input
          ref={ref}
          type="checkbox"
          className="h-4 w-4 rounded border border-zinc-700 bg-zinc-800 text-zinc-50"
          {...props}
        />
        {label ? <span className="text-sm text-zinc-300">{label}</span> : null}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
