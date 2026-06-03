import os
import re
import sys
import json
import subprocess
import tempfile
from pathlib import Path
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter

# Resolve yt-dlp inside the active venv regardless of system PATH
_SCRIPTS = Path(sys.executable).parent
YT_DLP = str(_SCRIPTS / "yt-dlp.exe") if (_SCRIPTS / "yt-dlp.exe").exists() else "yt-dlp"


def extract_youtube_id(url: str) -> str:
    patterns = [
        r"(?:v=|\/)([0-9A-Za-z_-]{11})",
        r"youtu\.be\/([0-9A-Za-z_-]{11})"
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    raise ValueError(f"Could not extract YouTube ID from: {url}")


def get_youtube_data(url: str) -> dict:
    video_id = extract_youtube_id(url)

    # --- Transcript ---
    try:
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        formatter = TextFormatter()
        transcript_text = formatter.format_transcript(transcript_list)
    except Exception as e:
        transcript_text = f"[Transcript unavailable: {e}]"

    # --- Metadata via yt-dlp (no API key) ---
    cmd = [YT_DLP, "--dump-json", "--no-download", "--no-warnings", url]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp metadata error: {result.stderr[:300]}")

    meta = json.loads(result.stdout)

    views    = int(meta.get("view_count", 0) or 0)
    likes    = int(meta.get("like_count", 0) or 0)
    comments = int(meta.get("comment_count", 0) or 0)
    engagement = round((likes + comments) / views * 100, 4) if views > 0 else 0.0

    return {
        "platform": "youtube",
        "url": url,
        "video_id": video_id,
        "title": meta.get("title", "Untitled"),
        "creator": meta.get("uploader", meta.get("channel", "Unknown")),
        "channel_follower_count": int(meta.get("channel_follower_count", 0) or 0),
        "views": views,
        "likes": likes,
        "comments": comments,
        "duration": int(meta.get("duration", 0) or 0),
        "upload_date": meta.get("upload_date", ""),
        "hashtags": [t for t in (meta.get("tags", []) or []) if t][:10],
        "description": (meta.get("description", "") or "")[:500],
        "engagement_rate": engagement,
        "transcript": transcript_text,
        "thumbnail": meta.get("thumbnail", ""),
    }


def get_instagram_data(url: str) -> dict:
    """
    Uses yt-dlp for metadata + downloads audio for Whisper transcription.
    Works for public Instagram Reels.
    """
    # Metadata
    cmd = [YT_DLP, "--dump-json", "--no-download", "--no-warnings", url]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp Instagram error: {result.stderr[:300]}")

    meta = json.loads(result.stdout)

    # Download audio for Whisper
    audio_path = os.path.join(tempfile.gettempdir(), f"ig_{meta.get('id','vid')}.mp3")
    dl_cmd = [
        YT_DLP, "-x", "--audio-format", "mp3",
        "--no-warnings", "-o", audio_path, url
    ]
    dl_result = subprocess.run(dl_cmd, capture_output=True, text=True, timeout=180)
    if dl_result.returncode != 0:
        transcript_text = "[Audio download failed — transcript unavailable]"
    else:
        transcript_text = transcribe_with_whisper(audio_path)
        try:
            os.remove(audio_path)
        except Exception:
            pass

    views    = int(meta.get("view_count", 0) or 0)
    likes    = int(meta.get("like_count", 0) or 0)
    comments = int(meta.get("comment_count", 0) or 0)
    engagement = round((likes + comments) / views * 100, 4) if views > 0 else 0.0

    desc = meta.get("description", meta.get("title", "")) or ""
    hashtags = re.findall(r"#\w+", desc)[:10]

    return {
        "platform": "instagram",
        "url": url,
        "video_id": meta.get("id", ""),
        "title": meta.get("title", desc[:80] or "Instagram Reel"),
        "creator": meta.get("uploader", meta.get("channel", "Unknown")),
        "channel_follower_count": int(meta.get("channel_follower_count", 0) or 0),
        "views": views,
        "likes": likes,
        "comments": comments,
        "duration": int(meta.get("duration", 0) or 0),
        "upload_date": meta.get("upload_date", ""),
        "hashtags": hashtags,
        "description": desc[:500],
        "engagement_rate": engagement,
        "transcript": transcript_text,
        "thumbnail": meta.get("thumbnail", ""),
    }


def transcribe_with_whisper(audio_path: str) -> str:
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel("base", device="cpu", compute_type="int8")
        segments, _ = model.transcribe(audio_path)
        return " ".join(seg.text for seg in segments).strip()
    except Exception as e:
        return f"[Whisper transcription failed: {e}]"
