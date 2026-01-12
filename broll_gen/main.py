from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from match_tags import get_matched_tags
from select_videos import select_best_video
from video_index import VIDEOS
from s3_utils import generate_presigned_video_url

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  
    ],
    allow_credentials=True,
    allow_methods=["*"],       
    allow_headers=["*"],       
)

class ScriptRequest(BaseModel):
    script: str

@app.post("/api/get-broll")
def get_stock_video(req: ScriptRequest):
    try:
        # 1️⃣ Extract tags from script
        matched_tags = get_matched_tags(req.script)

        if not matched_tags:
            return {"videoUrl": None, "matchedTags": [], "score": 0}

        # 2️⃣ Pick best video
        video = select_best_video(
            videos=VIDEOS,
            matched_tags=matched_tags,
        )

        if not video:
            return {"videoUrl": None, "matchedTags": [], "score": 0}
        
        print("Selected video:", video)
        print("S3 key:", video.get("s3_key"))
        
        url = generate_presigned_video_url(video["s3_key"])

        return {
            "videoUrl": url,
            "matchedTags": video["matched_tags"],
            "score": video["score"]
        }

    except Exception as e:
        # Debug-safe response
        return {"error": str(e)}

# import json
# from match_tags import get_matched_tags
# from select_videos import select_best_video
# from s3_utils import generate_presigned_video_url

# BUCKET_NAME = "broll-clips"

# # Load video metadata
# with open("video_metadata.json") as f:
#     videos = json.load(f)

# script = """
# Work today blends learning, problem-solving, and building systems that improve how people get things done. When routines support focus and growth, progress feels natural and sustainable.
# """

# # 🔹 Step 1: Tag matching
# matched_tags = get_matched_tags(script)

# print("\nMatched tags:")
# for tag, score in matched_tags:
#     print(tag, round(score, 3))

# # 🔹 Step 2: Select best video
# best_video = select_best_video(videos, matched_tags, min_overlap=1)

# # 🔹 Step 3: Generate presigned URL
# if best_video:
#     video_url = generate_presigned_video_url(
#         bucket=BUCKET_NAME,
#         s3_key=best_video["s3_key"]
#     )

#     print("\n✅ Selected video:")
#     print("S3 Key:", best_video["s3_key"])
#     print("Score:", best_video["score"])
#     print("Matched Tags:", best_video["matched_tags"])
#     print("URL:", video_url)
# else:
#     print("\n❌ No suitable video found")
