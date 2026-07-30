import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Generated rather than hand-exported, so the card can never drift from the
 * brand copy. Rendered at build time and cached at the edge.
 */
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A0C10",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "#E9ECF1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: "#FFB020",
              }}
            />
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: "#E9ECF1",
              letterSpacing: "-0.02em",
            }}
          >
            {site.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Satori requires an explicit display on any element with more than
              one child, so each line is its own single-text-child div. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.035em",
              color: "#E9ECF1",
              maxWidth: 980,
            }}
          >
            <div>Run every channel</div>
            <div style={{ color: "#FFB020" }}>from one desk.</div>
          </div>
          <div style={{ fontSize: 30, color: "#939BAB", maxWidth: 900 }}>
            Multi-network scheduling, an AI image studio and compliant
            comment-to-DM automation.
          </div>
        </div>

        {/* Signal rule */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 120, height: 6, borderRadius: 3, background: "#FFB020" }} />
          <div style={{ fontSize: 26, color: "#6B7383" }}>{site.domain}</div>
        </div>
      </div>
    ),
    size,
  );
}
