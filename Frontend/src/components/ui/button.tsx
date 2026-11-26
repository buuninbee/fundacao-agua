import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium font-sans transition-colors duration-200 hover:duration-150 active:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        // CTA principal conforme design.md (contraste AAA 9,5:1)
        default: 'bg-orange-500 text-blue-900 font-semibold shadow-xs hover:bg-orange-600',
        brand: 'bg-blue-500 text-white shadow-xs hover:bg-blue-600',
        destructive: 'bg-red-600 text-white shadow-xs hover:bg-red-700',
        outline:
          'border border-purple-600 bg-white text-blue-900 shadow-xs hover:bg-purple-200',
        secondary: 'bg-purple-400 text-blue-900 hover:bg-purple-500',
        ghost: 'text-blue-900 hover:bg-purple-300',
        link: 'text-blue-500 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
