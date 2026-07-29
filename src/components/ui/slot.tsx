import { Children, cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal `asChild` implementation: merges the wrapper's props onto its single
 * child element. Avoids pulling in Radix just to render a styled link.
 */
export function Slot({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const child = Children.only(children);
  if (!isValidElement<React.HTMLAttributes<HTMLElement>>(child)) return null;

  return cloneElement(child, {
    ...props,
    ...child.props,
    className: cn(className, child.props.className),
  });
}
