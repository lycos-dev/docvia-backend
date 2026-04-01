import React, { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  label?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const checkboxId =
      id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="flex items-center">
        <input
          type="checkbox"
          id={checkboxId}
          ref={ref}
          className={cn(
            "h-4 w-4 rounded-sm border-gray-300 accent-gray-700",
            "focus:ring-2 focus:ring-gray-400/20 focus:ring-offset-0",
            "cursor-pointer transition-colors",
            className,
          )}
          {...props}
        />
        {label && (
          <label
            htmlFor={checkboxId}
            className="ml-3 text-sm text-text-secondary cursor-pointer select-none font-normal"
          >
            {label}
          </label>
        )}
      </div>
    );
  },
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
