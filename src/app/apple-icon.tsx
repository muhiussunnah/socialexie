import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Apple's home-screen icon must be a raster format, so it is rendered rather
 * than served as SVG. The mark is embedded as a data URI so this file and
 * `icon.svg` stay visually identical without a shared build step.
 */
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="132" height="132">
  <circle cx="10.2" cy="16" r="3.2" fill="#FFB020"/>
  <g fill="none" stroke-linecap="round" stroke-width="3.4">
    <path d="M17 10.6a7.6 7.6 0 0 1 0 10.8" stroke="#FFB020"/>
    <path d="M22.6 6.6a13 13 0 0 1 0 18.8" stroke="#23C8AE"/>
  </g>
</svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0C10",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          width={132}
          height={132}
          alt=""
          src={`data:image/svg+xml;utf8,${encodeURIComponent(MARK)}`}
        />
      </div>
    ),
    size,
  );
}
