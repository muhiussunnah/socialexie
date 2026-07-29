/** Shown on documents that still need a lawyer's eyes before launch. */
export function DraftNotice() {
  return (
    <div className="mt-6 rounded-card border border-warn-soft bg-warn-soft p-4">
      <p className="text-[13px] leading-relaxed text-muted">
        <strong className="font-semibold text-fg">Draft.</strong> This document
        describes how Socialexie actually behaves today, but it has not been
        reviewed by a lawyer. Have counsel review it before you open the product
        to paying customers.
      </p>
    </div>
  );
}
