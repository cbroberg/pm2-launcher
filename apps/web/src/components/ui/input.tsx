import type { JSX } from 'preact';
import { cn } from '@/lib/utils';

type InputProps = JSX.InputHTMLAttributes<HTMLInputElement>;

export function Input({
  class: className,
  type = 'text',
  ...props
}: InputProps): JSX.Element {
  return (
    <input
      type={type}
      class={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className as string,
      )}
      {...props}
    />
  );
}

type LabelProps = JSX.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ class: className, ...props }: LabelProps): JSX.Element {
  return (
    <label
      class={cn('text-xs font-medium text-muted-foreground', className as string)}
      {...props}
    />
  );
}
