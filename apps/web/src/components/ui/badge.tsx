import { cva, type VariantProps } from 'class-variance-authority';
import type { JSX } from 'preact';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
        online: 'border-transparent bg-emerald-500/15 text-emerald-300',
        stopped: 'border-transparent bg-zinc-500/15 text-zinc-300',
        errored: 'border-transparent bg-rose-500/20 text-rose-300',
        launching: 'border-transparent bg-amber-500/15 text-amber-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type BadgeProps = JSX.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({
  class: className,
  variant,
  ...props
}: BadgeProps): JSX.Element {
  return (
    <div
      class={cn(badgeVariants({ variant }), className as string)}
      {...props}
    />
  );
}

export { badgeVariants };
