import os
import mimetypes
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import boto3
from boto3.s3.transfer import TransferConfig
from dotenv import load_dotenv

load_dotenv()
s3 = boto3.client(
    "s3",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION"),
)

BUCKET_NAME = os.getenv("S3_BUCKET_NAME")

def generate_presigned_video_url(s3_key: str, expires_in: int = 3600) -> str:
    return s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": BUCKET_NAME,
            "Key": s3_key,
            "ResponseContentType": "video/mp4",
            "ResponseCacheControl": "no-cache"
        },
        ExpiresIn=expires_in
    )

TRANSFER_CONFIG = TransferConfig(
    multipart_threshold=25 * 1024 * 1024,
    multipart_chunksize=25 * 1024 * 1024,
    max_concurrency=10,
    use_threads=True,
)

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}

def upload_video(file_path: str) -> str:
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(path)

    if path.suffix.lower() not in VIDEO_EXTENSIONS:
        raise ValueError(f"Not a video: {path.name}")

    s3_key = path.name
    content_type, _ = mimetypes.guess_type(path)
    content_type = content_type or "video/mp4"

    s3.upload_file(
        Filename=str(path),
        Bucket=BUCKET_NAME,
        Key=s3_key,
        ExtraArgs={"ContentType": content_type},
        Config=TRANSFER_CONFIG,
)
    return s3_key

def upload_videos_from_folder(
    folder_path: str,
    max_workers: int = 8,
) -> list[str]:
    """
    Upload all videos from a local folder to S3 bucket root in parallel.
    """
    folder = Path(folder_path)

    if not folder.exists() or not folder.is_dir():
        raise ValueError(f"Invalid folder: {folder_path}")

    video_files = [
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in VIDEO_EXTENSIONS
    ]

    if not video_files:
        print("⚠️ No video files found")
        return []

    print(f"📦 Found {len(video_files)} videos. Uploading...")
    uploaded_keys = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(upload_video, file): file
            for file in video_files
        }
        for future in as_completed(futures):
            file = futures[future]
            try:
                s3_key = future.result()
                uploaded_keys.append(s3_key)
                print(f"✅ Uploaded: {file.name}")
            except Exception as e:
                print(f"❌ Failed: {file.name} → {e}")

    print(f"🎉 Upload complete: {len(uploaded_keys)} files")
    return uploaded_keys

if __name__ == "__main__":
    BASE_DIR = Path(__file__).parent
    SAMPLE_DIR = BASE_DIR / "sample"

    uploaded = upload_videos_from_folder(SAMPLE_DIR)

    print("\nUploaded S3 keys:")
    for key in uploaded:
        print(" -", key)

