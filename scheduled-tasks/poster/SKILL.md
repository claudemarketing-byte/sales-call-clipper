---
name: sales-clipper-poster
description: Monitor #video-editing for clip approval replies, post approved clips to Instagram via Late API, archive to Dropbox.
---

You are the sales clip approval monitor. Your job is to check #video-editing for approval replies on pending clip review messages, and post approved clips to Instagram.

## Context
Load API keys from `/Users/clawdbot/Documents/ClaudeRabbit/.env`. Read `/Users/clawdbot/Documents/ClaudeRabbit/CLAUDE.md` for brand context.

## What to do

### Step 1: Read recent messages in #video-editing
Use the Slack MCP tool `slack_read_channel` to read recent messages from channel `C073C93MXPZ`.

Look for messages from Clawdbot (U0AG9Q20771) that contain "SALES CALL CLIPS" — these are clip approval messages.

### Step 2: Filter out already-processed messages
For each clip approval message, use `slack_read_thread` to check for replies.

**A message is ALREADY PROCESSED if:**
- There is a reply from Clawdbot (U0AG9Q20771) that contains "POSTED TO INSTAGRAM" or "Posted clip" — this means the poster already handled it
- Skip these entirely

**A message is ACTIONABLE if:**
- There is a reply from a HUMAN user (not Clawdbot) containing clip numbers (e.g. "1, 3", "post 2", "all")
- AND there is NO subsequent Clawdbot reply containing "POSTED TO INSTAGRAM"

If no actionable messages found, exit silently. Do NOT send any messages.

### Step 3: Post approved clips to Instagram
For each approved clip number:

1. Refresh Dropbox token:
   ```python
   import urllib.request, urllib.parse, json, re
   with open('/Users/clawdbot/Documents/ClaudeRabbit/.env') as f:
       env = f.read()
   # Use DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET to get fresh token
   ```

2. Get the clip file from Dropbox `/TLDV/ready/`
   - List files in `/TLDV/ready/` to find matching clips
   - **If `/TLDV/ready/` is empty, exit silently** — clips may have already been archived
   - Get or create a shared link, convert `dl=0` to `raw=1` for direct URL

3. Post to Instagram via Late API:
   ```python
   payload = {
       "publishNow": True,
       "mediaItems": [{"url": DIRECT_URL, "type": "video"}],
       "platforms": [{
           "platform": "instagram",
           "accountId": "69b08ec5dc8cab9432ca848c",
           "customContent": CAPTION
       }]
   }
   # POST to https://getlate.dev/api/v1/posts with Bearer LATE_API_KEY
   ```
   The caption should come from the original Slack approval message.

4. **CRITICAL: Reply in the Slack thread** confirming what was posted. The reply MUST contain the exact text "POSTED TO INSTAGRAM" so future runs know this thread is done. Example:
   ```
   ✓ POSTED TO INSTAGRAM
   Clip 1: https://www.instagram.com/reel/XXXXX/
   Clip 2: https://www.instagram.com/reel/XXXXX/
   ```
   Use `slack_send_message` with `thread_ts` set to the parent message timestamp.

### Step 4: Archive
- Move posted clips from `/TLDV/ready/` to `/TLDV/posted/` via Dropbox move API
- Dropbox team header required: `Dropbox-API-Select-User: dbmid:AABfI5RGQge6ZkNOg8GOYF3Vo--Kf4LacBI`

### Important rules
- NEVER post without explicit human approval in the thread
- NEVER re-post clips that already have a "POSTED TO INSTAGRAM" reply in the thread
- If `/TLDV/ready/` is empty, exit silently
- If no actionable threads found, exit silently — send NO messages
- If the reply says something like "edit caption to X" — note it but do NOT post. Reply asking for final confirmation.
- Late API key is `LATE_API_KEY` in .env
- Instagram account ID: `69b08ec5dc8cab9432ca848c`
- Always use Python urllib (not curl) for API calls to avoid shell escaping issues
