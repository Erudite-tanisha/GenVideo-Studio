import json
from pathlib import Path

VIDEO_METADATA_PATH = Path("video_metadata.json")

with open(VIDEO_METADATA_PATH, "r") as f:
    VIDEOS = json.load(f)

# Optional sanity check (prevents silent crashes)
assert isinstance(VIDEOS, list), "videos_metadata.json must be a list"
