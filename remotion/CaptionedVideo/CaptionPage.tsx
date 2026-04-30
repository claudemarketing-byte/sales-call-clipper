import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ─── Types ───────────────────────────────────────────────────
export type CaptionPageData = {
  startMs: number;
  endMs: number;
  words: { text: string; startMs: number; endMs: number }[];
};

// ─── Style Config ────────────────────────────────────────────
const FONT_FAMILY = "Montserrat, Arial Black, Impact, sans-serif";
const FONT_SIZE = 72;
const HIGHLIGHT_COLOR = "#FFD700";
const TEXT_COLOR = "#FFFFFF";
const ACTIVE_TEXT_COLOR = "#1A1A1A";
const BG_RADIUS = 10;

export const CaptionPage: React.FC<{ page: CaptionPageData }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Absolute time in video
  const absoluteTimeMs = page.startMs + (frame / fps) * 1000;

  // Simple quick fade in (no spring to avoid overlap artifacts)
  const pageOpacity = interpolate(frame, [0, 2], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 350,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px 12px",
          maxWidth: 920,
          padding: "0 50px",
          opacity: pageOpacity,
        }}
      >
        {/* All words in this page shown at once — highlight moves through them */}
        {page.words.map((word, i) => {
          if (!word.text) return null;

          const isActive =
            word.startMs <= absoluteTimeMs && word.endMs > absoluteTimeMs;

          return (
            <span
              key={`${word.startMs}-${i}`}
              style={{
                position: "relative",
                display: "inline-block",
                fontFamily: FONT_FAMILY,
                fontSize: FONT_SIZE,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
                lineHeight: 1.3,
                padding: "4px 14px",
                borderRadius: isActive ? BG_RADIUS : 0,
                backgroundColor: isActive ? HIGHLIGHT_COLOR : "transparent",
                color: isActive ? ACTIVE_TEXT_COLOR : TEXT_COLOR,
                textShadow: isActive
                  ? "none"
                  : "0 0 8px rgba(0,0,0,0.95), 0 3px 6px rgba(0,0,0,0.8), 3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000",
                WebkitTextStroke: isActive ? "none" : "2px black",
                paintOrder: "stroke fill",
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
