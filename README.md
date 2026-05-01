# Sales Call Clipper

Autonomous pipeline that turns TLDV sales call recordings into Instagram-ready clips. Detects best moments, surgically edits with ffmpeg, adds word-by-word captions + hook overlay via Remotion, sends to Slack for approval, posts to Instagram via Late API.

```
TLDV recording → Whisper transcribe → AI clip selection → ffmpeg surgical cut
              → Remotion captions + hook → Slack approval → Late API → Instagram
```

## Repo layout

```
skill/
  SKILL.md                    # Main /sales-call-clipper skill
scheduled-tasks/
  processor/SKILL.md          # Every 2hrs — checks Dropbox, processes new recordings
  poster/SKILL.md             # Every 30min — watches Slack for approvals, posts to IG
remotion/
  Root.tsx                    # Remotion compositions (modified for dynamic duration + hook overlay)
  CaptionedVideo/             # CaptionedVideo + HookOverlay components
memory/
  feedback_sales_clipper_v1.md
  feedback_caption_corrections.md
```

## Install on a new Mac

### 1. System dependencies

```bash
brew install ffmpeg node@20
# Optional — only if you want local Whisper instead of API:
brew install openai-whisper
```

### 2. Clone Remotion editor (required for rendering)

You need a Remotion project on the machine. If you don't have one, init one:

```bash
cd ~
npx create-video@latest remotion-editor
# Choose "Hello World" template
cd remotion-editor
npm install
```

Then copy our customizations on top:

```bash
cp <repo>/remotion/Root.tsx ~/remotion-editor/src/Root.tsx
cp -r <repo>/remotion/CaptionedVideo ~/remotion-editor/src/
mkdir -p ~/remotion-editor/public/raw
```

### 3. Install the skill

```bash
mkdir -p ~/Documents/ClaudeRabbit/all-skills/sales-call-clipper
cp <repo>/skill/SKILL.md ~/Documents/ClaudeRabbit/all-skills/sales-call-clipper/
```

Edit `SKILL.md` if your Remotion path is different from `/Users/clawdbot/remotion-editor`.

### 4. Install scheduled tasks (optional — for full autonomy)

```bash
mkdir -p ~/.claude/scheduled-tasks/sales-clipper-processor
mkdir -p ~/.claude/scheduled-tasks/sales-clipper-poster
cp <repo>/scheduled-tasks/processor/SKILL.md ~/.claude/scheduled-tasks/sales-clipper-processor/
cp <repo>/scheduled-tasks/poster/SKILL.md ~/.claude/scheduled-tasks/sales-clipper-poster/
```

Schedule them via Claude Code's `/schedule` skill:
- `sales-clipper-processor` — every 2 hours
- `sales-clipper-poster` — every 30 minutes

### 5. Memory files

```bash
mkdir -p ~/.claude/projects/<your-project-id>/memory
cp <repo>/memory/*.md ~/.claude/projects/<your-project-id>/memory/
```

Then reference them from your `MEMORY.md` index.

### 6. Required env vars

Create `~/Documents/ClaudeRabbit/.env` with:

```
OPENAI_API_KEY=...                    # Whisper transcription
TLDV_API_KEY=...                      # Recording downloads
DROPBOX_ACCESS_TOKEN=...              # Auto-refreshed at runtime
DROPBOX_REFRESH_TOKEN=...             # Persistent refresh
DROPBOX_APP_KEY=...
DROPBOX_APP_SECRET=...
LATE_API_KEY=...                      # Instagram posting
N8N_API_KEY=...                       # Optional — for n8n workflow management
```

Dropbox is a team account — the team member ID `dbmid:AABfI5RGQge6ZkNOg8GOYF3Vo--Kf4LacBI` is hardcoded in the skill. If you're on a different account, edit it.

### 7. Slack + Late API setup

The skill assumes:
- Slack channel `#video-editing` (`C073C93MXPZ`) for clip approval
- Late API Instagram account `69b08ec5dc8cab9432ca848c`

Edit those IDs in `skill/SKILL.md` and `scheduled-tasks/poster/SKILL.md` for your accounts.

### 8. Auto-pull from GitHub (recommended — keeps the Mini in sync)

So skill edits pushed from any machine propagate to the Mini within ~10 min without manual `git pull`:

```bash
bash scripts/install-auto-pull.sh
```

Idempotent. Logs changes + failures only (silent on no-op pulls) to `~/.sales-clipper-autopull.log`. To remove: `bash scripts/install-auto-pull.sh --uninstall`.

> macOS Sonoma+ may require Full Disk Access for `/usr/sbin/cron`. If pulls don't fire, check System Settings → Privacy & Security → Full Disk Access.

### 9. n8n workflow (optional — for fully autonomous TLDV → Dropbox)

Workflow ID `i2ggaJEFkSb4XEef` at `apprabbit.app.n8n.cloud` listens for TLDV `meeting.ready` webhooks and uploads to Dropbox. Configure your TLDV account to send webhooks to:

```
https://<your-n8n-instance>/webhook/tldv-recording
```

If you're setting up your own n8n, replicate the 5-node workflow:
1. Webhook trigger (`/tldv-recording`)
2. IF node — filter `event === "meeting.ready"`
3. HTTP Request — GET TLDV download URL
4. Code node — refresh Dropbox token + upload binary
5. Slack notify

## Usage

### Manual run
```
/sales-call-clipper
```
The skill prompts for a recording source (Dropbox, URL, or local file).

### Autonomous
Once scheduled tasks are running, drop calls into Dropbox `/TLDV/raw/` (or let the n8n webhook do it). Approval happens by replying in Slack with clip numbers (`1, 2`, `all`, etc.).

## Known issues

- Whisper transcription via API requires audio < 25MB — extract to mp3 first
- TLDV Zoom recordings are ~152kbps stereo. Apply `highpass=80,lowpass=8000,loudnorm=I=-16:TP=-1.5:LRA=11` for voice clarity
- Whisper hears "Trainerize" as "Trainer eyes" — see `memory/feedback_caption_corrections.md` for the fix
