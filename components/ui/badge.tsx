import React, { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'signal' | 'olive' | 'ink' | 'neutral' | 'outline' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export function Badge({ className, variant = 'neutral', size = 'md', pulse = false, children, ...props }: BadgeProps) {
  const variants = {
    signal: 'bg-[#F05A28]/15 text-[#F05A28] border-[#F05A28]/40',
    olive: 'bg-[#68715B]/25 text-[#9EB08C] border-[#68715B]/50',
    ink: 'bg-[#171D27] text-[#F4F4F5] border-[#292E38]',
    neutral: 'bg-[#121720] text-[#A1A1AA] border-[#292E38]',
    outline: 'bg-transparent text-[#A1A1AA] border-[#292E38]',
    // Aliases
    success: 'bg-[#68715B]/25 text-[#9EB08C] border-[#68715B]/50',
    warning: 'bg-[#F05A28]/15 text-[#F05A28] border-[#F05A28]/40',
    danger: 'bg-[#B91C1C]/20 text-[#F87171] border-[#B91C1C]/50',
    info: 'bg-[#171D27] text-[#F4F4F5] border-[#292E38]',
    accent: 'bg-[#F05A28] text-white border-[#F05A28]',
    purple: 'bg-[#68715B] text-white border-[#68715B]',
  };

  const sizes = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-0.5 text-xs',
    lg: 'px-3 py-1 text-xs font-bold',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono-tech uppercase font-semibold border rounded-none tracking-wider select-none transition-colors duration-150',
        variants[variant] || variants.neutral,
        sizes[size],
        className
      )}
      {...props}
    >
      {pulse && (
        <span className="inline-block w-1.5 h-1.5 bg-current animate-live-dot" />
      )}
      {children}
    </span>
  );
}
