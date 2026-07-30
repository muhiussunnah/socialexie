/**
 * Emits a JSON-LD graph.
 *
 * `application/ld+json` is not executable, so the CSP script-src rules do not
 * apply and no nonce is needed. The `<` escape guards against a stray value
 * closing the script element early.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
