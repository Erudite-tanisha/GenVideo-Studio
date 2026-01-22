import json
from pathlib import Path
from database import bulk_insert_videos, get_all_videos, test_connection

def migrate_from_json(json_file_path: str):
    """
    One-time migration: Import videos from JSON to PostgreSQL.
    """
    print(f"\n📦 Starting migration from {json_file_path}...")
    
    # Test connection first
    if not test_connection():
        print("❌ Cannot connect to database. Check your .env settings.")
        return
    
    # Load JSON file
    try:
        with open(json_file_path, 'r') as f:
            videos = json.load(f)
        print(f"✅ Loaded {len(videos)} videos from JSON")
    except FileNotFoundError:
        print(f"❌ File not found: {json_file_path}")
        return
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")
        return
    
    # Validate data structure
    for idx, video in enumerate(videos):
        if "s3_key" not in video or "tags" not in video:
            print(f"⚠️ Skipping invalid entry at index {idx}: {video}")
            videos[idx] = None
    
    videos = [v for v in videos if v is not None]
    
    if not videos:
        print("❌ No valid videos to migrate")
        return
    
    # Insert into database
    count = bulk_insert_videos(videos)
    
    if count > 0:
        print(f"\n🎉 Migration complete! {count} videos imported.")
        
        # Verify
        db_videos = get_all_videos()
        print(f"✅ Verification: Database now contains {len(db_videos)} videos")
        
        # Show sample
        if db_videos:
            print("\n📋 Sample entries:")
            for video in db_videos[:3]:
                print(f"   - {video['s3_key']}: {video['tags']}")
    else:
        print("❌ Migration failed")


if __name__ == "__main__":
    # Update this path to your JSON file location
    JSON_FILE = "video_metadata.json"  # Change if your file has a different name
    
    migrate_from_json(JSON_FILE)