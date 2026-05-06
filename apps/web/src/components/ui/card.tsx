import type { JSX } from 'preact';
import { cn } from '@/lib/utils';

type DivProps = JSX.HTMLAttributes<HTMLDivElement>;

export function Card({ class: className, ...props }: DivProps): JSX.Element {
  return (
    <div
      class={cn(
        'rounded-xl border bg-card text-card-foreground shadow',
        className as string,
      )}
      {...props}
    />
  );
}

export function CardHeader({ class: className, ...props }: DivProps): JSX.Element {
  return (
    <div
      class={cn('flex flex-col space-y-1.5 p-4', className as string)}
      {...props}
    />
  );
}

export function CardTitle({ class: className, ...props }: DivProps): JSX.Element {
  return (
    <div
      class={cn(
        'font-semibold leading-none tracking-tight',
        className as string,
      )}
      {...props}
    />
  );
}

export function CardContent({ class: className, ...props }: DivProps): JSX.Element {
  return <div class={cn('p-4 pt-0', className as string)} {...props} />;
}

export function CardFooter({ class: className, ...props }: DivProps): JSX.Element {
  return (
    <div
      class={cn('flex items-center p-4 pt-0 gap-2 flex-wrap', className as string)}
      {...props}
    />
  );
}
