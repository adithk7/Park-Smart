import React, { InputHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, type = 'text', ...props }, ref) => {
    return (
      <div className="flex flex-col space-y-1 w-full">
        {label && (
          <label className="text-xs font-mono-tech uppercase font-bold text-[#A1A1AA] tracking-wider">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            'w-full px-3.5 py-2.5 bg-[#121720] border border-[#292E38] rounded-none text-[#F4F4F5] placeholder-[#71717A] text-sm transition-colors duration-150 focus:outline-none focus:border-[#F05A28] focus-visible:ring-1 focus-visible:ring-[#F05A28] disabled:opacity-50',
            error && 'border-[#B91C1C] focus:border-[#B91C1C] focus-visible:ring-[#B91C1C]',
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs font-mono-tech text-[#F87171] font-semibold">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#A1A1AA]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, ...props }, ref) => {
    return (
      <div className="flex flex-col space-y-1 w-full">
        {label && (
          <label className="text-xs font-mono-tech uppercase font-bold text-[#A1A1AA] tracking-wider">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'w-full px-3.5 py-2.5 bg-[#121720] border border-[#292E38] rounded-none text-[#F4F4F5] text-sm transition-colors duration-150 focus:outline-none focus:border-[#F05A28] focus-visible:ring-1 focus-visible:ring-[#F05A28] disabled:opacity-50',
            error && 'border-[#B91C1C] focus:border-[#B91C1C] focus-visible:ring-[#B91C1C]',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs font-mono-tech text-[#F87171] font-semibold">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
