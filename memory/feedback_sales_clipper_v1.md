---
name: Sales Call Clipper — First Run Feedback
description: Critical fixes from first sales-call-clipper test run — Remotion props, framing, clip selection rules
type: feedback
---

## Remotion CaptionedVideo — always pass all three props

When rendering sales call clips with Remotion, you MUST pass `src`, `captionSrc`, AND `broll` in `--props`. The defaultProps in Root.tsx point to UGC content (talking_head.mp4, broll_01/02.mp4, captions.json). If you only override `src`, the captions and b-roll fall back to UGC defaults.

**Why:** First run produced clips with wrong captions and random b-roll footage overlaid because only `src` was overridden.

**How to apply:** Always use: `--props='{"src": "raw/clip-N.mp4", "captionSrc": "raw/clip-N.json", "broll": [], "durationInFrames": FRAMES}'`

Also: Root.tsx now uses `calculateMetadata` to accept dynamic `durationInFrames` from props. The old hardcoded 1736 frames no longer limits render range.

## Sales call framing — letterbox, never center crop

Sales calls must use letterbox padding (`pad=1080:1920:...:color=0x111111`), NOT center crop (`crop=ih*9/16:ih`). Center crop on a Zoom call zooms into faces and looks terrible.

**Why:** First run center-cropped landscape Zoom footage to fill 9:16, making faces uncomfortably close and cutting off screen share context.

**How to apply:** Use `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x111111` for all sales call clips.

## Clip selection — strict standalone and quality rules

- Never include admin/logistics moments (email collection, scheduling, "can you hear me", goodbye)
- Every clip must start at the beginning of a complete thought and end at the completion
- Cut all dead air — no awkward pauses, "um"s, or screen share loading
- Context test: would a random Instagram viewer understand this clip with zero context?

**Why:** First run included a clip of Josh collecting De Bolton's email (zero content value) and a clip that started mid-nutrition-discussion and ended mid-community-discussion with awkward pauses.

**How to apply:** Apply these rules during AI clip selection step. When in doubt, skip the clip.

## No pricing in clips — ever

Never include clips where specific dollar amounts, monthly fees, or total costs are mentioned. Prospects watching should never learn pricing from a social clip.

**Why:** Clips showing the 10K build fee and $349/mo were rejected. Pricing is a sales conversation, not social content.

**How to apply:** During clip selection, auto-reject any segment containing dollar amounts or pricing discussion. The only exception would be a brilliant objection handle where the actual number isn't audible.

## No failed-close tactics visible

Never include clips showing: free trials being offered, payment plans as fallback, "let me send you info" moments, or any language suggesting the prospect didn't close.

**Why:** A clip showing the salesman offering a 2-week free trial signals to future prospects that they can ask for the same concession. It undermines the sales process.

**How to apply:** Any post-pitch concession or fallback offer is auto-rejected during clip selection.

## No inaccurate claims

If the salesperson states a specific number or claim that may not be accurate (e.g. "we have 4000 recipes"), flag it for surgical removal from the clip.

**Why:** The "4000 recipes" claim was not accurate. Rather than discard the whole clip, surgically cut just that line using ffmpeg trim+concat.

**How to apply:** After clip selection, review each segment for specific claims. When in doubt, cut the claim and keep the surrounding content.

## Surgical editing is required — not optional

Every clip must go through a second pass where filler words, pauses, repeated phrases, "um"s, and fluff are surgically removed using ffmpeg filter_complex trim+concat. Target 28-40 seconds per final clip.

**Why:** First cuts were 59-70 seconds with lots of dead air. After surgical editing they dropped to 28-43 seconds and were dramatically better.

**How to apply:** After initial ffmpeg cuts, read the Whisper segment-level transcript, identify gold vs fluff, and re-cut with segment-level precision.

## Hook text overlay + /hook-generator for captions

Every clip gets a text hook displayed for the first 5 seconds (Remotion `hookText` prop) plus an Instagram caption. Use /hook-generator to generate options from the Supabase hook databases before picking.

**Why:** User requested hook text overlays and captions generated from proven frameworks.

**How to apply:** After clips are selected and surgically edited, run /hook-generator with clip context, pick hooks, then render with hookText prop.
