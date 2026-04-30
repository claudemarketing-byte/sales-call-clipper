---
name: sales-call-clipper
description: Autonomous agent that takes TLDV sales call recordings, identifies the best moments, cuts clips, adds captions via Remotion, sends to Slack for emoji approval, and posts approved clips to Instagram. Use when processing sales calls for content.
---

# Sales Call Clipper — Autonomous Pipeline

Turn Matt's TLDV sales calls into Instagram-ready clips. Fully autonomous from raw recording to posted content, with Slack approval gate.

**Pipeline:** TLDV recording → Whisper transcribe → AI clip selection → ffmpeg cut → Remotion captions → Slack approval → Late API → Instagram

---

## Dropbox Config (CRITICAL)

This is a **team Dropbox**. Every API call MUST include the team member header:

```
Dropbox-API-Select-User: dbmid:AABfI5RGQge6ZkNOg8GOYF3Vo--Kf4LacBI
```

The access token expires every 4 hours. **Always refresh before starting:**

```python
import urllib.request, urllib.parse, json, re

with open('/Users/clawdbot/Documents/ClaudeRabbit/.env') as f:
    env = f.read()

def get_val(key):
    m = re.search(rf'^{key}=(.+)$', env, re.MULTILINE)
    return m.group(1).strip() if m else None

# Refresh token
data = urllib.parse.urlencode({
    'grant_type': 'refresh_token',
    'refresh_token': get_val('DROPBOX_REFRESH_TOKEN'),
    'client_id': get_val('DROPBOX_APP_KEY'),
    'client_secret': get_val('DROPBOX_APP_SECRET')
}).encode()
req = urllib.request.Request('https://api.dropbox.com/oauth2/token', data=data, method='POST')
token = json.loads(urllib.request.urlopen(req).read())['access_token']

# Update .env
env = re.sub(r'DROPBOX_ACCESS_TOKEN=.*', f'DROPBOX_ACCESS_TOKEN={token}', env)
with open('/Users/clawdbot/Documents/ClaudeRabbit/.env', 'w') as f:
    f.write(env)

MEMBER_ID = 'dbmid:AABfI5RGQge6ZkNOg8GOYF3Vo--Kf4LacBI'
```

Use `token` and `MEMBER_ID` for all subsequent Dropbox calls in this session.

---

## Source: Where Recordings Come From

### Option A: Dropbox folder (default — fed by n8n webhook)

n8n receives TLDV webhook when a recording finishes, downloads it, and drops it in Dropbox:

```python
body = json.dumps({'path': '/TLDV/raw', 'include_media_info': True}).encode()
req = urllib.request.Request('https://api.dropboxapi.com/2/files/list_folder', data=body, method='POST')
req.add_header('Authorization', f'Bearer {token}')
req.add_header('Content-Type', 'application/json')
req.add_header('Dropbox-API-Select-User', MEMBER_ID)
entries = json.loads(urllib.request.urlopen(req).read())['entries']
for e in entries:
    print(f"{e['name']} ({e['size']} bytes)")
```

### Option B: Direct file path or URL

User provides a local path, Google Drive link, or direct URL. Download with yt-dlp if needed:

```bash
python3 ~/.claude/skills/video-downloader/scripts/download_video.py "URL" -o /tmp/sales-clipper/
```

### Option C: Manual upload

User drops file at `/tmp/sales-clipper/raw.mp4` or any local path.

---

## Step 1: Download and Prepare

```bash
mkdir -p /tmp/sales-clipper/clips /tmp/sales-clipper/captioned
```

```python
# Download from Dropbox (uses token + MEMBER_ID from Dropbox Config section)
import urllib.request, json

filename = 'FILENAME'  # Replace with actual filename
api_arg = json.dumps({'path': f'/TLDV/raw/{filename}'})
req = urllib.request.Request('https://content.dropboxapi.com/2/files/download', method='POST')
req.add_header('Authorization', f'Bearer {token}')
req.add_header('Dropbox-API-Arg', api_arg)
req.add_header('Dropbox-API-Select-User', MEMBER_ID)
data = urllib.request.urlopen(req).read()
with open('/tmp/sales-clipper/full-call.mp4', 'wb') as f:
    f.write(data)
print(f'Downloaded {len(data)} bytes')
```

```bash
# Get duration for context
ffprobe -v error -show_entries format=duration -of csv=p=0 /tmp/sales-clipper/full-call.mp4
```

---

## Step 2: Transcribe with Whisper (word-level timestamps)

```bash
python3 -c "
import whisper
import json

model = whisper.load_model('medium')
result = model.transcribe('/tmp/sales-clipper/full-call.mp4', word_timestamps=True)

# Save full transcript
with open('/tmp/sales-clipper/transcript.txt', 'w') as f:
    for seg in result['segments']:
        ts = f\"[{int(seg['start']//60)}:{int(seg['start']%60):02d}]\"
        f.write(f\"{ts} {seg['text'].strip()}\n\")

# Save word-level timestamps for Remotion
with open('/tmp/sales-clipper/words.json', 'w') as f:
    words = []
    for seg in result['segments']:
        for w in seg.get('words', []):
            words.append({'word': w['word'], 'start': w['start'], 'end': w['end']})
    json.dump(words, f)

print('Transcript saved.')
print(f\"Total segments: {len(result['segments'])}\")
print(f\"Duration: {result['segments'][-1]['end']:.0f}s\")
"
```

Read the transcript file to understand the full call context before proceeding.

---

## Step 3: AI Clip Selection — The Money Step

Feed the transcript to Claude with this analysis prompt. Read the transcript from `/tmp/sales-clipper/transcript.txt` and analyze it.

### Analysis Prompt

```
You are an AI trained to analyze sales call transcripts and extract the most emotionally charged, persuasive, or high-value moments.

Identify and return ALL moments that fit the following categories:

**High-Emotion Moments**
Any spike in excitement, enthusiasm, surprise, frustration, disbelief, relief, or strong conviction.
Include timestamp and 1-2 sentence context.

**Compliments**
Anything positive said about:
- AppRabbit
- Its features or results
- The salesperson
- The experience
Include timestamp, exact quote, and a short paraphrase.

**Hype or "This Looks Amazing" Reactions**
Prospect expresses being impressed, excited, or clearly leaning toward buying.
Include timestamp and why it stands out.

**Humorous or Charismatic Moments**
Any joke, laugh, witty remark, or personality-driven moment.
Include timestamp, quote, and quick context.

**Outstanding or High-Leverage Clips**
Great sales lines, competitor comparisons, objections being broken, or moments that would work well in marketing or testimonials.
Include timestamp and short explanation.

**Buying Decision Moments**
The moment the prospect decides to purchase, says they're in, asks how to pay, or commits verbally.
Also capture micro buying signals such as: "This makes sense," "I'm ready," "Let's do it," or clear mindset shifts.
Include timestamp, quote, and what triggered the decision.

**Post-Purchase Humor or Goodwill**
After they decide to buy:
Any humor, laughter, positive energy, appreciation toward AppRabbit or the salesperson, or comments showing excitement or relief.
Include timestamp, quote, and why it's emotionally valuable.

**Loyalty or Good-Willed Sentiment**
Anything that suggests they'll refer others, appreciate the process, trust the product, align with the mission, or express gratitude or confidence.
Include timestamp, quote, and summary.
```

### Output Format Required

After analysis, structure each selected moment as:

```json
[
  {
    "id": 1,
    "category": "hype_reaction",
    "start_time": 124.5,
    "end_time": 158.2,
    "quote": "Oh my god, this is exactly what I've been looking for",
    "context": "Prospect sees the custom-branded app for the first time",
    "clip_title": "Coach sees their branded app for the first time",
    "instagram_hook": "Watch a coach's face when they see their own app in the App Store",
    "priority": "high"
  }
]
```

### Clip Selection Rules

- **Target clip length: 30-60 seconds.** Add 3s padding before and after each moment.
- **Minimum 3 clips, maximum 8 clips** per call (don't flood the feed).
- **Priority ranking**: Hype reactions > Compliments > Feature demos with strong reactions > Humor > Everything else. (Buying decisions are deprioritized because they usually involve price discussion.)
- **Combine adjacent moments** if they're within 15 seconds of each other into one longer clip (max 90s).
- **Skip anything where audio quality is poor**, someone is talking over each other, or context is missing without the rest of the call.
- Each clip must make sense **standalone** — a viewer with zero context should understand the emotion.
- **NEVER include admin/logistics moments** — collecting emails, scheduling follow-ups, saying goodbye, asking "can you hear me?", screen share setup, etc. These have zero content value.
- **Clean in/out points**: Each clip must start at the beginning of a complete thought and end at the completion of a thought. Never cut into the middle of a sentence or between two unrelated topics.
- **Cut all dead air**: Mark pauses longer than 1.5 seconds for removal. The final clip should feel tight and snappy — no awkward silences, "um"s, or waiting for screen shares to load.
- **Context test**: Before including a clip, ask: "If someone saw ONLY this 30-60 second clip on Instagram with no other context, would they understand what's happening and why it matters?" If no, either widen the clip boundaries or skip it.
- **NEVER include pricing discussions** — no clips where specific dollar amounts, monthly fees, or total costs are mentioned. The only exception is a clip of the salesperson handling a price objection brilliantly, and even then the actual price number must not be audible. Prospects watching should never learn our pricing from a clip.
- **NEVER include failed-close tactics** — no clips showing free trials being offered, payment plans as a fallback, "let me send you more info" moments, or any language that signals the prospect didn't close on the call. Other prospects who see these clips will anchor on asking for the same concessions.
- **NEVER include inaccurate claims** — if the salesperson states a specific number (e.g. "we have 4000 recipes") that may not be accurate, flag it for removal. When in doubt, cut the specific claim and keep the surrounding content.
- **Surgical editing required** — after initial clip selection, go through each clip segment-by-segment and remove all filler words, pauses, "um"s, repeated phrases, and fluff. Use ffmpeg filter_complex with trim+concat to stitch together only the gold. Target 28-40 seconds per final clip.

Save the clip list to `/tmp/sales-clipper/clips.json`.

---

## Step 4: Cut Clips with ffmpeg

For each clip in `clips.json`:

```bash
# Read clips.json and cut each clip
python3 -c "
import json, subprocess

with open('/tmp/sales-clipper/clips.json') as f:
    clips = json.load(f)

for clip in clips:
    cid = clip['id']
    start = max(0, clip['start_time'] - 3)  # 3s padding before
    end = clip['end_time'] + 3               # 3s padding after
    duration = end - start

    # Letterbox into 9:16 with dark background (NOT center crop — sales calls need context)
    cmd = [
        'ffmpeg', '-y',
        '-i', '/tmp/sales-clipper/full-call.mp4',
        '-ss', str(start),
        '-t', str(duration),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x111111',
        f'/tmp/sales-clipper/clips/clip-{cid}.mp4'
    ]
    subprocess.run(cmd, capture_output=True)
    print(f'Cut clip {cid}: {start:.1f}s - {end:.1f}s ({duration:.1f}s)')
"
```

**Important**: The `-vf scale` filter ensures all clips are 9:16 vertical for Reels. If the source is landscape (sales call screen share), it will be letterboxed. For landscape-heavy calls, consider cropping to the speaker's face region instead.

---

## Step 5: Caption Each Clip via Remotion

For each cut clip:

### 5a: Generate per-clip captions

```bash
# For each clip, run Whisper to get word-level timestamps
for clip_file in /tmp/sales-clipper/clips/clip-*.mp4; do
    CLIP_NAME=$(basename "$clip_file" .mp4)
    python3 -c "
import whisper, json
model = whisper.load_model('medium')
result = model.transcribe('$clip_file', word_timestamps=True)
words = []
for seg in result['segments']:
    for w in seg.get('words', []):
        words.append({'word': w['word'], 'start': w['start'], 'end': w['end']})
with open('/tmp/sales-clipper/clips/${CLIP_NAME}.json', 'w') as f:
    json.dump(words, f)
print(f'Captioned: ${CLIP_NAME} ({len(words)} words)')
"
done
```

### 5b: Copy clips to Remotion and render

```bash
# Copy each clip + caption json to Remotion public/raw
for clip_file in /tmp/sales-clipper/clips/clip-*.mp4; do
    CLIP_NAME=$(basename "$clip_file" .mp4)
    cp "$clip_file" ~/remotion-editor/public/raw/
    cp "/tmp/sales-clipper/clips/${CLIP_NAME}.json" ~/remotion-editor/public/raw/
done

# Render each clip with captions — MUST pass all three props to override UGC defaults
cd ~/remotion-editor
for clip_file in public/raw/clip-*.mp4; do
    CLIP_NAME=$(basename "$clip_file" .mp4)
    # Calculate duration in frames (30fps)
    DURATION_SEC=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$clip_file")
    DURATION_FRAMES=$(python3 -c "import math; print(math.ceil(float('${DURATION_SEC}') * 30))")
    
    # hookText is set per-clip from clips.json "instagram_hook" field (displayed first 5s)
    HOOK_TEXT=""  # Set from clips.json or /hook-generator output
    
    npx remotion render CaptionedVideo \
        "/tmp/sales-clipper/captioned/${CLIP_NAME}-captioned.mp4" \
        --props="{\"src\": \"raw/${CLIP_NAME}.mp4\", \"captionSrc\": \"raw/${CLIP_NAME}.json\", \"broll\": [], \"durationInFrames\": ${DURATION_FRAMES}, \"hookText\": \"${HOOK_TEXT}\"}" \
        --pixel-format=yuv420p \
        --crf=18
done
```

---

## Step 6: Upload to Dropbox and Send to Slack for Approval

### 6a: Upload captioned clips to Dropbox

Uses `token` and `MEMBER_ID` from the Dropbox Config section at the top.

```python
import urllib.request, json, os, glob

clips = glob.glob('/tmp/sales-clipper/captioned/clip-*-captioned.mp4')
preview_links = {}

for clip_path in clips:
    clip_name = os.path.basename(clip_path)
    dropbox_path = f'/TLDV/ready/{clip_name}'

    # Upload
    with open(clip_path, 'rb') as f:
        file_data = f.read()
    api_arg = json.dumps({'path': dropbox_path, 'mode': 'overwrite'})
    req = urllib.request.Request('https://content.dropboxapi.com/2/files/upload', data=file_data, method='POST')
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Dropbox-API-Arg', api_arg)
    req.add_header('Dropbox-API-Select-User', MEMBER_ID)
    req.add_header('Content-Type', 'application/octet-stream')
    urllib.request.urlopen(req)

    # Create share link
    body = json.dumps({'path': dropbox_path, 'settings': {'requested_visibility': 'public'}}).encode()
    req = urllib.request.Request('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', data=body, method='POST')
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Dropbox-API-Select-User', MEMBER_ID)
    try:
        resp = json.loads(urllib.request.urlopen(req).read())
        preview_links[clip_name] = resp['url']
    except urllib.error.HTTPError as e:
        # Link already exists — fetch it
        body2 = json.dumps({'path': dropbox_path, 'direct_only': True}).encode()
        req2 = urllib.request.Request('https://api.dropboxapi.com/2/sharing/list_shared_links', data=body2, method='POST')
        req2.add_header('Authorization', f'Bearer {token}')
        req2.add_header('Content-Type', 'application/json')
        req2.add_header('Dropbox-API-Select-User', MEMBER_ID)
        resp2 = json.loads(urllib.request.urlopen(req2).read())
        preview_links[clip_name] = resp2['links'][0]['url']

    print(f'Uploaded: {clip_name} → {preview_links[clip_name]}')
```

### 6b: Send Slack approval message

Send ONE message to Matthew (Slack user ID: `U035KSBHH3Q`) with all clips for review.

Use the Slack MCP tool `slack_send_message`:

```
Channel: U035KSBHH3Q
Message format:

▶ SALES CALL CLIPS READY FOR REVIEW

{number} clips extracted from: {call_title}

CLIP 1 — {clip_title}
Category: {category} | Duration: {duration}s | Priority: {priority}
Quote: "{quote}"
Caption: {instagram_hook}
Preview: {dropbox_preview_link}
React ✅ to approve · ✕ to skip

CLIP 2 — {clip_title}
...

React ✅ on each clip you want posted to Instagram.
React ✕ to skip.
Reply with edits if you want to change a caption.
```

**STOP HERE. Do not proceed to posting until approval is received.**

---

## Step 7: Check Approval and Post

When the user confirms approved clips (either in Slack or in conversation):

### 7a: Generate captions for approved clips

Read the caption voice guide at `AppRabbit Content/reference/caption-voice.md` before writing captions.

For each approved clip, use the `instagram_hook` from the clip analysis as the base, then refine it to match Matthew's voice:
- One line. Punchy.
- The video does the talking.
- No hashtag spam (use 3-5 relevant ones max).

### 7b: Post via Late API

```bash
LATE_API_KEY=$(grep LATE_API_KEY /Users/clawdbot/Documents/ClaudeRabbit/.env | cut -d'=' -f2)
DROPBOX_TOKEN=$(grep DROPBOX_ACCESS_TOKEN /Users/clawdbot/Documents/ClaudeRabbit/.env | cut -d'=' -f2)

# Get direct download URL for the clip
SHARE_RESPONSE=$(curl -s -X POST https://api.dropboxapi.com/2/sharing/list_shared_links \
    -H "Authorization: Bearer $DROPBOX_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"path": "/TLDV/ready/CLIP_FILENAME", "direct_only": true}')

SHARE_URL=$(echo "$SHARE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['links'][0]['url'])")
DIRECT_URL=$(echo "$SHARE_URL" | sed 's/dl=0/raw=1/')

# Post to Instagram only
python3 -c "
import requests, os

api_key = os.popen('grep LATE_API_KEY /Users/clawdbot/Documents/ClaudeRabbit/.env').read().split('=',1)[1].strip()

resp = requests.post('https://getlate.dev/api/v1/posts',
    headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
    json={
        'publishNow': True,
        'mediaItems': [{'url': '$DIRECT_URL', 'type': 'video'}],
        'platforms': [{
            'platform': 'instagram',
            'accountId': '69b08ec5dc8cab9432ca848c',
            'customContent': '''CAPTION_HERE'''
        }]
    })
print(f'Status: {resp.status_code}')
print(resp.json())
"
```

### Late API Quirks (from post-content skill)

- Use `raw=1` (not `dl=1`) for Dropbox direct URLs
- Always use Python requests (not curl) to avoid shell escaping issues
- **NEVER auto-retry failed posts** — report and wait for confirmation
- Check for 409 "already posted" before any retry

---

## Step 8: Archive

After successful posting, move clips and original recording:

```python
# Move posted clips to /TLDV/posted/
def dropbox_move(from_path, to_path):
    body = json.dumps({'from_path': from_path, 'to_path': to_path}).encode()
    req = urllib.request.Request('https://api.dropboxapi.com/2/files/move_v2', data=body, method='POST')
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Dropbox-API-Select-User', MEMBER_ID)
    urllib.request.urlopen(req)
    print(f'Moved: {from_path} → {to_path}')

# Move each posted clip
for clip_name in posted_clips:  # list of filenames that were successfully posted
    dropbox_move(f'/TLDV/ready/{clip_name}', f'/TLDV/posted/{clip_name}')

# Move original recording
dropbox_move(f'/TLDV/raw/{original_filename}', f'/TLDV/processed/{original_filename}')
```

---

## Cleanup

```bash
rm -rf /tmp/sales-clipper
# Remove clip files from Remotion public/raw (keep it clean)
rm -f ~/remotion-editor/public/raw/clip-*
```

---

## TLDV API Config

**API Base URL:** `https://pasta.tldv.io/v1alpha1`
**Auth Header:** `x-api-key` (NOT Bearer — this is different from most APIs)
**API Key:** stored in `.env` as `TLDV_API_KEY`

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/meetings` | GET | List all meetings |
| `/meetings/{id}` | GET | Get meeting metadata |
| `/meetings/{id}/download` | GET | Get signed download URL (expires 6hrs) — returns 302 redirect |
| `/meetings/{id}/transcript` | GET | Get transcript with timestamps |

### Webhook Events (configured in TLDV Settings → Webhooks)

| Event | Fires when | Payload |
|-------|-----------|---------|
| `MeetingReady` | Recording processed | `{ event, executedAt, data: { id, happenedAt, name, organizer, invitees, url } }` |
| `TranscriptReady` | Transcript complete | `{ event, executedAt, data: { id, meetingId, transcript } }` |

### Downloading a recording via API

**Important:** The download endpoint returns binary video data directly (Content-Type: video/mp4), not a redirect URL. Also requires a User-Agent header to bypass Cloudflare.

```python
import urllib.request, re

with open('/Users/clawdbot/Documents/ClaudeRabbit/.env') as f:
    env = f.read()
TLDV_KEY = re.search(r'^TLDV_API_KEY=(.+)$', env, re.MULTILINE).group(1).strip()

meeting_id = 'MEETING_ID'  # from webhook payload or /meetings list

req = urllib.request.Request(f'https://pasta.tldv.io/v1alpha1/meetings/{meeting_id}/download')
req.add_header('x-api-key', TLDV_KEY)
req.add_header('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')

with open('/tmp/sales-clipper/full-call.mp4', 'wb') as f:
    resp = urllib.request.urlopen(req)
    while True:
        chunk = resp.read(1024*1024)
        if not chunk: break
        f.write(chunk)
```

---

## n8n Webhook Workflow — TLDV Sales Call Relay (Fully Automated)

**Workflow ID:** `i2ggaJEFkSb4XEef`
**Status:** Active
**Instance:** `apprabbit.app.n8n.cloud`

### Architecture

```
[TLDV Webhook: POST /tldv-recording]
  → [IF: Is MeetingReady?]
  → [HTTP: Download recording from TLDV API]
  → [Code: Refresh Dropbox token + Upload to /TLDV/raw/]
  → [Slack: DM Matthew — "Recording saved, run /sales-call-clipper"]
```

### Production Webhook URL

```
https://apprabbit.app.n8n.cloud/webhook/tldv-recording
```

### What happens automatically

1. TLDV fires `MeetingReady` webhook after a call ends
2. n8n checks it's the right event type
3. Downloads the recording via TLDV API (`/meetings/{id}/download`)
4. Refreshes Dropbox token and uploads to `/TLDV/raw/{meeting-name}.mp4`
5. Sends Slack DM to Matthew with filename and path

### TLDV Webhook Configuration

1. Go to **TLDV Settings → Webhooks** (or Settings → Integrations → Webhooks)
2. Click **"Configure new Webhook"**
3. Set **Event Action**: `MeetingReady`
4. Set **Endpoint URL**: `https://apprabbit.app.n8n.cloud/webhook/tldv-recording`
5. Save

---

## Dropbox Folder Structure

```
/TLDV/
├── raw/           ← n8n drops recordings here
├── ready/         ← Captioned clips waiting for approval
├── posted/        ← Clips that have been published
└── processed/     ← Original recordings after clipping
```

---

## Video Format Notes

- **Sales calls are typically landscape** (Zoom/Google Meet screen share)
- **DEFAULT: Letterbox with dark background** — do NOT force center crop. Sales calls need the full frame visible so viewers can see the Zoom layout, screen share, and both participants.
- Target output: **1080x1920 (9:16), 30fps, H.264**
- The letterbox padding color should be dark (`#111111`) to look clean on mobile

### Letterbox (default for sales calls):

```bash
ffmpeg -y -i input.mp4 \
    -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x111111" \
    -c:v libx264 -pix_fmt yuv420p -c:a aac output-vertical.mp4
```

### Center crop (ONLY use if explicitly asked — e.g. isolating one person's face):

```bash
ffmpeg -y -i input.mp4 \
    -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920" \
    -c:v libx264 -pix_fmt yuv420p -c:a aac output-vertical.mp4
```

> **Pixel format note:** Always pin `-pix_fmt yuv420p` on libx264 outputs. Without it, ffmpeg can pass through `yuvj420p` (JPEG full-range YUV) from a Zoom/HDR source, which Dropbox's web preview rejects as "corrupted" even though the file plays fine. Same goes for Remotion renders (`--pixel-format=yuv420p`).

---

## Quick Run Checklist

1. [ ] Recording available (Dropbox `/TLDV/raw/` or local path)
2. [ ] Whisper transcription complete
3. [ ] AI analysis identified best clips
4. [ ] Clips cut with ffmpeg
5. [ ] Captions added via Remotion
6. [ ] Uploaded to Dropbox `/TLDV/ready/`
7. [ ] Slack message sent for approval
8. [ ] User approved via emoji/conversation
9. [ ] Posted to Instagram via Late API
10. [ ] Archived to `/TLDV/posted/`
