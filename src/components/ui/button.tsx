import { Slot } from "@/components/ui/slot";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-45 " +
  "[&_svg]:shrink-0 [&_svg]:size-4";

const variants: Record<Variant, string> = {
  primary:
    "bg-signal text-signal-fg shadow-e1 hover:brightness-108 focus-visible:shadow-signal",
  secondary:
    "bg-surface-2 text-fg border border-line hover:bg-surface-3 hover:border-line-strong",
  outline:
    "border border-line-strong text-fg hover:bg-surface-2 hover:border-signal",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger text-white hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Render as the single child element instead of a `<button>`. */
  asChild?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
