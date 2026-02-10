from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import os
import json
from match_tags import get_matched_tags
from select_videos import select_best_video
from s3_utils import generate_presigned_video_url, download_from_s3, upload_to_s3
from video_composer import compose_video
from fastapi.responses import FileResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScriptRequest(BaseModel):
    script: str

class ComposeRequest(BaseModel):
    a_roll: str
    b_rolls: list


@app.post("/api/get-broll")
def get_stock_video(req: ScriptRequest):
    try:
        matched_tags = get_matched_tags(req.script)

        if not matched_tags:
            return {"videoUrl": None, "matchedTags": [], "score": 0}
        
        video = select_best_video(matched_tags)

        if not video:
            return {"videoUrl": None, "matchedTags": matched_tags, "score": 0}
        

        print("Selected video:", video)
        print("S3 key:", video.get("s3_key"))
        url = generate_presigned_video_url(video["s3_key"])

        return {
            "videoUrl": url,
            "matchedTags": video["matched_tags"],
            "score": video["score"],
        }

    except Exception as e:
        return {"error": str(e)}
    
@app.post("/api/compose-video")
async def compose_video_api(
    a_roll: UploadFile = File(...),
    b_rolls: list[UploadFile] = File(...),
    b_roll_meta: str = Form(...)
):
    try:
        os.makedirs("uploads", exist_ok=True)
        a_roll_path = f"uploads/{uuid.uuid4()}_{a_roll.filename}"
        with open(a_roll_path, "wb") as f:
            f.write(await a_roll.read())

        meta = json.loads(b_roll_meta)

        b_rolls_local = []
        for i, file in enumerate(b_rolls):
            path = f"uploads/{uuid.uuid4()}_{file.filename}"
            with open(path, "wb") as f:
                f.write(await file.read())

            m = next(m for m in meta if m["index"] == i)

            b_rolls_local.append({
                "path": path,
                "start": m["start"],
                "duration": m["duration"],
            })

        final_path = compose_video(a_roll_path, b_rolls_local)

        return FileResponse(
    path=final_path,
    media_type="video/mp4",
    filename="final.mp4"
)

    except Exception as e:
        return {"error": str(e)}


# @app.post("/api/compose-video")
# async def compose_video_api(
#     a_roll: UploadFile = File(...),
#     b_rolls: str = Form(...)  # JSON string
# ):
#     try:
#         # Save uploaded A-roll locally
#         a_roll_path = f"/tmp/{uuid.uuid4()}_{a_roll.filename}"

#         with open(a_roll_path, "wb") as f:
#             f.write(await a_roll.read())


#         # Parse B-roll metadata
#         b_rolls_data = json.loads(b_rolls)

#         b_rolls_local = []
#         for b in b_rolls_data:
#             local_path = download_from_s3(b["s3_key"])
#             b_rolls_local.append({
#                 "path": local_path,
#                 "start": b["start"],
#                 "duration": b["duration"],
#             })


#         # Compose final video
#         final_path = f"/tmp/final_{uuid.uuid4()}.mp4"
#         compose_video(
#             a_roll_path=a_roll_path,
#             b_rolls=b_rolls_local,
#             output_path=final_path
#         )

#         return {
#             "status": "success",
#             "local_path": final_path
#         }

#     except Exception as e:
#         return {"error": str(e)}


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
