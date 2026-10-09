import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'olive' | 'danger' | 'glow';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 ease-out active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F05A28]/60 disabled:opacity-40 disabled:cursor-not-allowed select-none rounded-none border text-sm';

    const variants = {
      primary: 'bg-[#F05A28] hover:bg-[#DC4C1C] active:bg-[#C23E14] text-white border-[#F05A28] font-bold tracking-tight shadow-sm',
      secondary: 'bg-[#171D27] hover:bg-[#1E2532] active:bg-[#121720] text-[#F4F4F5] border-[#292E38] hover:border-[#3E4552] font-semibold',
      outline: 'bg-transparent hover:bg-[#171D27] text-[#F4F4F5] border-[#292E38] hover:border-[#3E4552] font-semibold',
      ghost: 'bg-transparent hover:bg-[#171D27] text-[#A1A1AA] hover:text-[#F4F4F5] border-transparent font-medium',
      olive: 'bg-[#68715B] hover:bg-[#58604D] text-white border-[#68715B] font-semibold',
      danger: 'bg-[#B91C1C] hover:bg-[#991B1B] text-white border-[#B91C1C] font-semibold',
      glow: 'bg-[#F05A28] hover:bg-[#DC4C1C] text-white border-[#F05A28] font-bold tracking-tight shadow-sm',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs gap-1.5 font-mono-tech',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3.5 text-base gap-2.5 font-bold',
      icon: 'p-2',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="font-mono-tech">PROCESSING...</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
