---
name: Caption word corrections for Whisper transcription
description: Known words Whisper gets wrong — fix in caption JSON before rendering. Critical for brand names.
type: feedback
---

Always post-process Whisper captions to fix known misheard words before rendering through Remotion.

| Whisper Output | Correct | Context |
|---|---|---|
| "Trainer eyes" / "trainer eyes" | "Trainerize" | Competitor app name — Whisper splits it into two words |

**Why:** First Nikki Pepper clip had "Trainer eyes" on screen instead of "Trainerize". Looks unprofessional and confusing.

**How to apply:** After generating caption JSON from Whisper, scan for known corrections and fix before rendering. Add new entries to this table as they come up. Also watch for: AppRabbit, Kahuna's/Kahunas, Everfit, Macroactive.
