import React, { ReactNode, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, description, children, className }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-opacity">
      <div
        className={cn(
          'relative w-full max-w-lg glass-card rounded-2xl p-6 shadow-2xl border border-slate-700/60 animate-in fade-in zoom-in-95 duration-200',
          className
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        {title && <h3 className="text-xl font-semibold text-white tracking-tight pr-6">{title}</h3>}
        {description && <p className="text-sm text-slate-400 mt-1 mb-4">{description}</p>}

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
