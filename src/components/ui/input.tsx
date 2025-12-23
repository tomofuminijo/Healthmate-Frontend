import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  "flex w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-input",
        // Healthmate専用バリアント
        healthmate: "border-gray-300 focus:border-blue-500 focus:ring-blue-200 transition-all duration-200",
        error: "border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50/50",
        success: "border-green-300 focus:border-green-500 focus:ring-green-200 bg-green-50/50",
        warning: "border-amber-300 focus:border-amber-500 focus:ring-amber-200 bg-amber-50/50"
      },
      size: {
        default: "h-10",
        sm: "h-9 px-2 text-sm",
        lg: "h-12 px-4 text-base",
        // Healthmate専用サイズ
        healthmate: "h-11 px-4 text-base rounded-md"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  tabIndex?: number;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input, inputVariants }