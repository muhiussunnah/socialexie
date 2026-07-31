"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Reveals its children once they scroll into view.
 *
 * One observer per element, disconnected after the first intersection — a
 * reveal that keeps observing is a reveal that keeps costing. The hidden state
 * is applied in an effect and gated on `.js-ready` in CSS, so content is never
 * trapped invisible when scripting is unavailable.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  /** Milliseconds, for staggering siblings. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.dataset.reveal = "shown";
      return;
    }

    node.dataset.reveal = "pending";
    node.style.transitionDelay = `${delay}ms`;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        node.dataset.reveal = "shown";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/**
 * Splits a headline into words that arrive one after another on load. Each word
 * keeps its own span so the browser can still wrap the line normally.
 */
export function WordReveal({
  text,
  className,
  wordClassName,
  startDelay = 0,
  step = 55,
}: {
  text: string;
  className?: string;
  /** Applied to every word — used to gradient a whole phrase. */
  wordClassName?: string;
  startDelay?: number;
  step?: number;
}) {
  return (
    <span className={className}>
      {text.split(" ").map((word, index) => (
        <span
          key={`${word}-${index}`}
          className={cn("inline-block animate-word", wordClassName)}
          style={{ animationDelay: `${startDelay + index * step}ms` }}
        >
          {word}
          {index < text.split(" ").length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
