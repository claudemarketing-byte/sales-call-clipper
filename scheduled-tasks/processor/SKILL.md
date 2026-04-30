---
name: sales-clipper-processor
description: Check TLDV API for new sales call recordings, run full clipper pipeline (transcript, select clips, surgical edit, Remotion captions + hooks, upload), send to #video-editing for approval.
---

You are the autonomous sales call clipper. Your job is to check for new recordings and process them into Instagram-ready clips.

## Context
Read the full skill doc at `/Users/clawdbot/Documents/ClaudeRabbit/all-skills/sales-call-clipper/SKILL.md` for detailed instructions. Read `/Users/clawdbot/Documents/ClaudeRabbit/CLAUDE.md` for brand context. Load API keys from `/Users/clawdbot/Documents/ClaudeRabbit/.env`.

## What to do

### Phase 1: Check for new recordings via TLDV API

**Do NOT rely on Dropbox /TLDV/raw/ — pull directly from the TLDV API instead.**

The TLDV API key is `TLDV_API_KEY` in `.env`. Auth header is `x-api-key` (not Bearer).

```python
import urllib.request, json, re
from datetime import datetime, timedelta, timezone

with open('/Users/clawdbot/Documents/ClaudeRabbit/.env') as f:
    env = f.read()
TLDV_KEY = re.search(r'^TLDV_API_KEY=(.+)$', env, re.MULTILINE).group(1).strip()

# Fetch page 1 of meetings (most recent first)
req = urllib.request.Request('https://pasta.tldv.io/v1alpha1/meetings?page=1&pageSize=50')
req.add_header('x-api-key', TLDV_KEY)
req.add_header('User-Agent', 'Mozilla/5.0')
meetings = json.loads(urllib.request.urlopen(req).read())['results']
```

Filter for **sales calls only** — name must contain `<> AppRabbit` or `<>AppRabbit`. Exclude any name containing: `Check-in`, `Onboarding`, `Build`, `Team`, `Internal`, `Interview`. Minimum duration: 600 seconds (10 min).

Only process calls from the **last 7 days**.

2. Refresh Dropbox token and list files in `/TLDV/processed/` to know which meeting IDs are already done. The processed marker filenames follow the pattern `{Name}_AppRabbit_{date}.mp4`.

3. For unprocessed calls: download via TLDV API, fetch transcript via TLDV API (no Whisper needed for the full call — TLDV has transcripts with timestamps already). If no new calls, exit silently.

### TLDV API — Key Endpoints
- `GET /v1alpha1/meetings?page=N&pageSize=50` — list meetings
- `GET /v1alpha1/meetings/{id}/transcript` — returns `{data: [{startTime, endTime, speaker, text}]}` with timestamps in seconds
- `GET /v1alpha1/meetings/{id}/download` — binary MP4 download (requires `User-Agent` header)

**Use the TLDV transcript API instead of Whisper for the full call** — it's instant and already has speaker-labelled timestamps in seconds. Only run Whisper on the short clips (30-50s) for word-level caption timing.

### Phase 2: For each new recording, run the full pipeline
1. Download from TLDV API to `/tmp/sales-clipper/{slug}-call.mp4` (use slug like `craig`, `cookie`, etc.)
2. Fetch transcript via TLDV API → save to `/tmp/sales-clipper/{slug}-transcript.json`
3. Read the transcript and select clips using the analysis prompt from SKILL.md

**CRITICAL GUARDRAILS for clip selection:**
- NEVER include clips where specific dollar amounts or pricing is mentioned
- NEVER include failed-close tactics (free trials offered, payment plans as fallback, "send more info")
- NEVER include admin moments (email collection, scheduling, goodbyes)
- Every clip must make sense standalone to a random Instagram viewer
- Clean in/out points only — start and end at complete thoughts

4. Cut clips with ffmpeg using LETTERBOX framing (NOT center crop):
   `-c:v libx264 -pix_fmt yuv420p -vf 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x111111'`
   **Always pin `-pix_fmt yuv420p`** — Zoom/Mac sources can be `yuvj420p` (full-range JPEG YUV), which Dropbox web preview rejects as "corrupted" even though the file is valid.

5. **Surgical editing pass** — for each clip:
   - Read the Whisper segment-level transcript
   - Identify gold moments vs filler (pauses, "um"s, repeated phrases, fluff)
   - Re-cut using ffmpeg filter_complex trim+concat to stitch only the gold segments
   - Target 28-40 seconds per final clip

6. Transcribe each tight clip with Whisper for per-clip captions
7. Convert to Remotion caption format (startMs/endMs/timestampMs/confidence)
8. Copy to `~/remotion-editor/public/raw/`

9. **Generate hooks** — query Supabase (project: crnqccdoxjhgdqrgcvck) for hook frameworks:
   ```sql
   SELECT spoken_hook, spoken_hook_framework, spoken_hook_structure, views FROM kallaway_hooks WHERE spoken_hook_framework IS NOT NULL ORDER BY views DESC LIMIT 20
   ```
   Pick the best hook framework for each clip and adapt it.

10. Render with Remotion — MUST pass all props to override defaults, AND pin pixel format:
    ```
    npx remotion render CaptionedVideo output.mp4 --props='{"src":"raw/clip-N.mp4","captionSrc":"raw/clip-N.json","broll":[],"durationInFrames":FRAMES,"hookText":"THE HOOK TEXT"}' --pixel-format=yuv420p --crf=18
    ```
    `--pixel-format=yuv420p` is required so Dropbox web preview doesn't show "corrupted" on the captioned clip.

11. Upload captioned clips to Dropbox `/TLDV/ready/` and get preview links

12. Send ONE approval message to Slack #video-editing (channel ID: C073C93MXPZ) with all clips, preview links, and suggested captions. Include the clip number, duration, quote, hook text, and caption for each.

13. Move the original recording from `/TLDV/raw/` to `/TLDV/processed/` so it's not picked up again.

14. Clean up temp files in `/tmp/sales-clipper/`

### Important notes
- Dropbox is a team account — EVERY API call needs header: `Dropbox-API-Select-User: dbmid:AABfI5RGQge6ZkNOg8GOYF3Vo--Kf4LacBI`
- Remotion CaptionedVideo uses `calculateMetadata` for dynamic duration — pass durationInFrames in props
- Instagram account ID for Late API: `69b08ec5dc8cab9432ca848c`
- If no new recordings found, just exit — don't send any messages
- Slack approval channel is #video-editing, channel ID: `C073C93MXPZ` — NOT a DM to the user
- TLDV API base: `https://pasta.tldv.io/v1alpha1` — auth header is `x-api-key`, NOT `Authorization: Bearer`
- Always add `User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)` to TLDV download requests
- Whisper mishears to watch for and correct in captions: "Arby's" → "AppRabbit", "trainer eyes" → "Trainerize"
- When marking calls as processed in Dropbox, upload a tiny marker file to `/TLDV/processed/{Name}_AppRabbit_{date}.mp4`
- Download all calls for a batch first in parallel, then process sequentially — don't download one at a time
