import React, { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'panel' | 'elevated' | 'outline' | 'bordered';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'panel', children, ...props }, ref) => {
    const variants = {
      panel: 'bg-[#171D27] border border-[#292E38] text-[#F4F4F5]',
      elevated: 'bg-[#121720] border border-[#292E38] text-[#F4F4F5]',
      outline: 'bg-transparent border border-[#292E38] text-[#F4F4F5]',
      bordered: 'bg-[#171D27] border border-[#292E38] hover:border-[#3E4552] text-[#F4F4F5]',
    };

    return (
      <div
        ref={ref}
        className={cn('p-6 rounded-none transition-all duration-200 ease-out', variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1 mb-5', className)} {...props}>
      {children}
    </div>
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-xl font-bold text-[#F4F4F5] tracking-tight leading-snug', className)} {...props}>
      {children}
    </h3>
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-[#A1A1AA] leading-relaxed', className)} {...props}>
      {children}
    </p>
  )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props}>
      {children}
    </div>
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center pt-4 mt-5 border-t border-[#292E38]', className)} {...props}>
      {children}
    </div>
  )
);
CardFooter.displayName = 'CardFooter';
