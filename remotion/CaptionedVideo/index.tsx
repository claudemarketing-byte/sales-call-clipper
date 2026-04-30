import React, { useMemo } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  staticFile,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { CaptionPage, type CaptionPageData } from "./CaptionPage";
import type { BrollEntry, CaptionedVideoProps } from "../Root";

type WordCaption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number;
  confidence: number;
};

const WORDS_PER_PAGE = 5;
const CROSSFADE_FRAMES = 5;

function buildPages(words: WordCaption[]): CaptionPageData[] {
  const pages: CaptionPageData[] = [];
  let i = 0;

  while (i < words.length) {
    const pageWords: WordCaption[] = [];

    for (let j = 0; j < WORDS_PER_PAGE && i < words.length; j++, i++) {
      pageWords.push(words[i]);

      const text = words[i].text.trim();
      if (text.endsWith(".") || text.endsWith("!") || text.endsWith("?")) {
        i++;
        break;
      }
    }

    if (pageWords.length > 0) {
      pages.push({
        startMs: pageWords[0].startMs,
        endMs: pageWords[pageWords.length - 1].endMs,
        words: pageWords.map((w) => ({
          text: w.text.trim(),
          startMs: w.startMs,
          endMs: w.endMs,
        })),
      });
    }
  }

  return pages;
}

// ─── B-Roll Clip with Crossfade ─────────────────────────────
const BrollClip: React.FC<{ src: string; durationInFrames: number }> = ({
  src,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [0, CROSSFADE_FRAMES, durationInFrames - CROSSFADE_FRAMES, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      <OffthreadVideo
        src={staticFile(src)}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
};

// ─── Hook Text Overlay (first 5 seconds) ──────────────────
const HookOverlay: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hookDuration = 5 * fps; // 5 seconds

  if (frame >= hookDuration || !text) return null;

  const opacity = interpolate(
    frame,
    [0, 10, hookDuration - 15, hookDuration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: "18%",
        opacity,
      }}
    >
      <div
        style={{
          color: "white",
          fontSize: 54,
          fontWeight: 800,
          fontFamily: "Arial, Helvetica, sans-serif",
          textAlign: "center",
          textShadow: "0 2px 8px rgba(0,0,0,0.7), 0 0 20px rgba(0,0,0,0.4)",
          padding: "0 60px",
          lineHeight: 1.3,
          maxWidth: "90%",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Composition ───────────────────────────────────────
export const CaptionedVideo: React.FC<CaptionedVideoProps> = ({
  src,
  broll,
  captionSrc,
  hookText,
}) => {
  const { fps } = useVideoConfig();

  // Load caption data dynamically from the public folder
  const [captionWords, setCaptionWords] = React.useState<WordCaption[]>([]);

  React.useEffect(() => {
    fetch(staticFile(captionSrc))
      .then((res) => res.json())
      .then((data) => setCaptionWords(data))
      .catch(() => setCaptionWords([]));
  }, [captionSrc]);

  const pages = useMemo(() => {
    return buildPages(captionWords);
  }, [captionWords]);

  return (
    <AbsoluteFill>
      {/* Layer 1: Talking head — full duration, with audio */}
      <OffthreadVideo
        src={staticFile(src)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Layer 2: B-roll overlays — muted, crossfaded */}
      {broll.map((clip, index) => {
        const startFrame = Math.round(clip.startSec * fps);
        const endFrame = Math.round(clip.endSec * fps);
        const durationFrames = endFrame - startFrame;

        if (durationFrames <= 0) return null;

        return (
          <Sequence
            key={`broll-${index}`}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <BrollClip src={clip.src} durationInFrames={durationFrames} />
          </Sequence>
        );
      })}

      {/* Layer 3: Captions — word-by-word highlight */}
      {pages.map((page, index) => {
        const startFrame = Math.round((page.startMs / 1000) * fps);

        const nextStartMs =
          index < pages.length - 1
            ? pages[index + 1].startMs
            : page.endMs + 300;
        const durationFrames = Math.max(
          1,
          Math.round(((nextStartMs - page.startMs) / 1000) * fps)
        );

        return (
          <Sequence
            key={`caption-${index}`}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <CaptionPage page={page} />
          </Sequence>
        );
      })}

      {/* Layer 4: Hook text overlay — first 5 seconds */}
      {hookText && <HookOverlay text={hookText} />}
    </AbsoluteFill>
  );
};
