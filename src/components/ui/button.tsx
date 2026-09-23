import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none h-11 px-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-95 shadow-sm",
        secondary: "bg-card border border-border hover:bg-background",
        ghost: "hover:bg-card",
        danger: "bg-danger text-white",
        ink: "bg-ink text-white hover:opacity-90",
        outline: "border-2 border-current bg-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Button({
  className,
  variant,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant }), className)} {...props} />;
}
