import "server-only";

import { socialEnv } from "@/lib/env";

/**
 * Token encryption at rest.
 *
 * OAuth access/refresh tokens must never touch the database in the clear, so
 * they are sealed with AES-256-GCM before they are stored and opened only on
 * the server the moment a publish runs. Web Crypto is used deliberately — it
 * runs unchanged on the Cloudflare Worker runtime, where Node's `crypto` module
 * is not available.
 *
 * Envelope layout, base64-encoded:
 *
 *   [ version : 1 byte ][ iv : 12 bytes ][ ciphertext + gcm tag ]
 *
 * The version byte lets the key or scheme be rotated later without guessing at
 * the format of anything already written.
 */

const VERSION = 1;
const IV_BYTES = 12;
/** GCM tag is 16 bytes; a valid envelope is at least version + iv + tag. */
const MIN_ENVELOPE_BYTES = 1 + IV_BYTES + 16;

let keyPromise: Promise<CryptoKey> | null = null;

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Import the workspace key once per runtime. The key material is read lazily so
 * a missing secret only surfaces when a token is actually sealed or opened, in
 * keeping with the rest of `env.ts`.
 */
function encryptionKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const raw = base64ToBytes(socialEnv().SOCIAL_TOKEN_ENC_KEY);
      if (raw.length !== 32) {
        throw new Error(
          "SOCIAL_TOKEN_ENC_KEY must be base64 for exactly 32 bytes (AES-256).",
        );
      }
      return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
        "encrypt",
        "decrypt",
      ]);
    })();
  }
  return keyPromise;
}

/** Seal a token string into a self-describing base64 envelope. */
export async function encryptToken(plain: string): Promise<string> {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plain),
    ),
  );

  const envelope = new Uint8Array(1 + IV_BYTES + ciphertext.length);
  envelope[0] = VERSION;
  envelope.set(iv, 1);
  envelope.set(ciphertext, 1 + IV_BYTES);
  return bytesToBase64(envelope);
}

/** Open an envelope produced by {@link encryptToken}. Throws on tamper/mismatch. */
export async function decryptToken(envelope: string): Promise<string> {
  const key = await encryptionKey();
  const bytes = base64ToBytes(envelope);
  if (bytes.length < MIN_ENVELOPE_BYTES || bytes[0] !== VERSION) {
    throw new Error("Malformed or unsupported token envelope.");
  }

  const iv = bytes.subarray(1, 1 + IV_BYTES);
  const ciphertext = bytes.subarray(1 + IV_BYTES);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plain);
}
