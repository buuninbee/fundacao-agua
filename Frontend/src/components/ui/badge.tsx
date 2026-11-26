import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold font-sans transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-blue-500 text-white',
        secondary: 'border-purple-600 bg-purple-200 text-blue-900',
        orange: 'border-orange-300 bg-orange-50 text-orange-900',
        excellent: 'border-emerald-300 bg-emerald-50 text-emerald-800',
        attention: 'border-amber-300 bg-amber-50 text-amber-800',
        critical: 'border-red-300 bg-red-50 text-red-700',
        offline: 'border-purple-700 bg-purple-300 text-blue-900',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
