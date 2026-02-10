import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Dict, Optional
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

# Database configuration
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 5432)),
    "database": os.getenv("DB_NAME", "genvideo"),
    "user": os.getenv("DB_USER", "tanishasaini"),
}

if os.getenv("DB_PASSWORD"):
    DB_CONFIG["password"] = os.getenv("DB_PASSWORD")


@contextmanager
def get_db_connection():
    """Context manager for database connections with auto-commit/rollback."""
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        yield conn
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ Database error: {e}")
        raise e
    finally:
        if conn:
            conn.close()


def insert_video(s3_key: str, tags: List[str]) -> bool:
    """
    Insert a single video with tags.
    Updates tags if s3_key already exists.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO videos (s3_key, tags)
                    VALUES (%s, %s)
                    ON CONFLICT (s3_key) 
                    DO UPDATE SET 
                        tags = EXCLUDED.tags, 
                        updated_at = NOW()
                    """,
                    (s3_key, tags)
                )
        print(f"✅ Inserted/Updated: {s3_key} with {len(tags)} tags")
        return True
    except Exception as e:
        print(f"❌ Failed to insert {s3_key}: {e}")
        return False


def bulk_insert_videos(videos: List[Dict[str, any]]) -> int:
    """
    Bulk insert videos from your JSON structure.
    Format: [{"s3_key": "video.mov", "tags": ["tag1", "tag2"]}, ...]
    """
    if not videos:
        return 0
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                data = [(v["s3_key"], v["tags"]) for v in videos]
                cur.executemany(
                    """
                    INSERT INTO videos (s3_key, tags)
                    VALUES (%s, %s)
                    ON CONFLICT (s3_key) 
                    DO UPDATE SET 
                        tags = EXCLUDED.tags, 
                        updated_at = NOW()
                    """,
                    data
                )
        print(f"✅ Bulk inserted {len(videos)} videos")
        return len(videos)
    except Exception as e:
        print(f"❌ Bulk insert failed: {e}")
        return 0


def get_videos_by_tags(tags: List[str]) -> List[Dict]:
    """
    Get all videos that have ANY of the provided tags.
    Uses PostgreSQL's array overlap operator (&&) for fast lookups.
    """
    if not tags:
        return []
    
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT s3_key, tags
                    FROM videos
                    WHERE tags && %s
                    ORDER BY id
                    """,
                    (tags,)
                )
                results = [dict(row) for row in cur.fetchall()]
                print(f"🔍 Found {len(results)} videos matching tags: {tags}")
                return results
    except Exception as e:
        print(f"❌ Query failed: {e}")
        return []


def get_all_videos() -> List[Dict]:
    """Get all videos with their tags."""
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT s3_key, tags FROM videos ORDER BY id")
                results = [dict(row) for row in cur.fetchall()]
                print(f"📊 Retrieved {len(results)} total videos")
                return results
    except Exception as e:
        print(f"❌ Query failed: {e}")
        return []


def get_video_by_key(s3_key: str) -> Optional[Dict]:
    """Get a specific video by its s3_key."""
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT s3_key, tags FROM videos WHERE s3_key = %s",
                    (s3_key,)
                )
                result = cur.fetchone()
                return dict(result) if result else None
    except Exception as e:
        print(f"❌ Query failed: {e}")
        return None


def delete_video(s3_key: str) -> bool:
    """Delete a video by s3_key."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM videos WHERE s3_key = %s", (s3_key,))
                deleted = cur.rowcount > 0
                if deleted:
                    print(f"🗑️ Deleted: {s3_key}")
                else:
                    print(f"⚠️ Video not found: {s3_key}")
                return deleted
    except Exception as e:
        print(f"❌ Delete failed: {e}")
        return False


def get_all_unique_tags() -> List[str]:
    """Get all unique tags across all videos."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT DISTINCT unnest(tags) as tag
                    FROM videos
                    ORDER BY tag
                    """
                )
                tags = [row[0] for row in cur.fetchall()]
                print(f"🏷️ Found {len(tags)} unique tags")
                return tags
    except Exception as e:
        print(f"❌ Query failed: {e}")
        return []


def test_connection() -> bool:
    """Test database connection."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                result = cur.fetchone()
                if result[0] == 1:
                    print("✅ Database connection successful!")
                    return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False


# Test the connection when module is imported
if __name__ == "__main__":
    print("Testing database connection...")
    test_connection()