from typing import List, Tuple, Dict, Optional
from collections import defaultdict
import database
from s3_utils import generate_presigned_video_url

MatchedTag = Tuple[str, float]

VIDEO_USAGE_TRACKER = defaultdict(int)
USAGE_PENALTY_RATE = 0.20  # 20% penalty per use

def score_video(
    video_tags: List[str],
    matched_tags: List[MatchedTag],
    video_key: str
) -> Tuple[float, List[str]]:
    """
    Score video based on tag overlap with smart penalties.
    """
    if not matched_tags or not video_tags:
        return 0.0, []
    
    matched_tag_map = dict(matched_tags)
    matched_tag_set = set(matched_tag_map.keys())
    
    # Calculate base score from matching tags
    score = 0.0
    matched = []
    
    for tag in video_tags:
        if tag in matched_tag_map:
            score += matched_tag_map[tag]
            matched.append(tag)
        else:
            score -= 0.05

    if not matched:
        return 0.0, []

    if len(matched) > 1:
        match_bonus = min(len(matched) * 0.10, 0.40)
        score += match_bonus


    precision = len(matched) / len(video_tags)
    
    # Penalty if video has too many irrelevant tags
    if precision < 0.4:  # Less than 40% relevant
        score *= 0.6
    elif precision < 0.6:  # Less than 60% relevant
        score *= 0.8

    # Anti-repetition penalty
    usage_count = VIDEO_USAGE_TRACKER.get(video_key, 0)
    if usage_count > 0:
        penalty_factor = 1.0 - (usage_count * USAGE_PENALTY_RATE)
        score *= max(penalty_factor, 0.25)  # Never go below 25%

    return round(score, 3), matched


def select_best_video(
    matched_tags: List[MatchedTag],  
    exclude_videos: Optional[List[str]] = None,
    min_tag_overlap: int = 1
) -> Optional[Dict]:
    """
    Select the best matching video from database.
    Now fetches videos from PostgreSQL instead of JSON.
    """
    
    if not matched_tags:
        return None

    # Extract tag names for database query
    tag_names = [tag for tag, _ in matched_tags]
    
    # Fetch matching videos from database
    videos = database.get_videos_by_tags(tag_names)
    
    if not videos:
        print("⚠️ No videos found in database matching these tags")
        return None

    exclude_videos = exclude_videos or []
    best_video = None
    best_score = 0.0
    
    for video in videos:
        video_key = video["s3_key"]
        video_tags = video["tags"]
        
        if video_key in exclude_videos:
            continue

        score, matched = score_video(video_tags, matched_tags, video_key)

        if not matched or len(matched) < min_tag_overlap:
            continue

        if score > best_score:
            best_score = score
            best_video = {
                "s3_key": video_key,
                "tags": video_tags,
                "score": score,
                "matched_tags": matched,
                "precision": len(matched) / len(video_tags),
                "usage_count": VIDEO_USAGE_TRACKER.get(video_key, 0)
            }

    if best_video:
        VIDEO_USAGE_TRACKER[best_video["s3_key"]] += 1
        best_video["video_url"] = generate_presigned_video_url(best_video["s3_key"])
        print(f"-- Presigned URL --{best_video["video_url"]}")
        print(f"🎯 Selected: {best_video['s3_key']} (score: {best_video['score']})")

    return best_video

# def select_best_video(
#     # videos: List[Dict],
#     matched_tags: List[MatchedTag],
#     exclude_videos: Optional[List[str]] = None,
#     min_tag_overlap: int = 1
# ) -> Optional[Dict]:
#     """
#     Select the best matching video with diversity enforcement.
#     """
    
#     if not videos or not matched_tags:
#         return None

#     exclude_videos = exclude_videos or []
#     best_video = None
#     best_score = 0.0
    
#     for video in videos:
#         video_key = video.get("s3_key")
#         video_tags = video.get("tags", [])
        
#         # Skip if excluded or no tags
#         if not video_tags or video_key in exclude_videos:
#             continue

#         # Calculate score
#         score, matched = score_video(video_tags, matched_tags, video_key)

#         # Skip if no overlap or below minimum
#         if not matched or len(matched) < min_tag_overlap:
#             continue

#         if score > best_score:
#             best_score = score
#             best_video = {
#                 "s3_key": video_key,
#                 "tags": video_tags,
#                 "score": score,
#                 "matched_tags": matched,
#                 "precision": len(matched) / len(video_tags),
#                 "usage_count": VIDEO_USAGE_TRACKER.get(video_key, 0)
#             }

#     # Track usage
#     if best_video:
#         VIDEO_USAGE_TRACKER[best_video["s3_key"]] += 1

#     return best_video



def select_multiple_videos(
    matched_tags: List[MatchedTag], 
    count: int = 3,
    min_tag_overlap: int = 1
) -> List[Dict]:
    """
    Select multiple diverse videos for a script.
    Now fetches from database.
    """
    selected = []
    exclude = []
    
    for _ in range(count):
        video = select_best_video(
            matched_tags, 
            exclude_videos=exclude,
            min_tag_overlap=min_tag_overlap
        )
        
        if not video:
            break
            
        selected.append(video)
        exclude.append(video["s3_key"])
    
    return selected


# def select_multiple_videos(
#     videos: List[Dict],
#     matched_tags: List[MatchedTag],
#     count: int = 3,
#     min_tag_overlap: int = 1
# ) -> List[Dict]:
#     """
#     Select multiple diverse videos for a script.
#     """
#     selected = []
#     exclude = []
    
#     for _ in range(count):
#         video = select_best_video(
#             videos, 
#             matched_tags, 
#             exclude_videos=exclude,
#             min_tag_overlap=min_tag_overlap
#         )
        
#         if not video:
#             break
            
#         selected.append(video)
#         exclude.append(video["s3_key"])
    
#     return selected


def reset_usage_tracker():
    """Reset usage tracking (call at session start/end)."""
    VIDEO_USAGE_TRACKER.clear()


if __name__ == "__main__":
    matched_tags = [
        ("expressive", 0.50),
        ("technology", 0.45),
        ("calm", 0.20)
    ]
    
    print("Matched tags:", matched_tags)
    print("\n" + "="*60)
    
    best = select_best_video(matched_tags)
    if best:
        print(f"\n🏆 Best video: {best['s3_key']}")
        print(f"   Score: {best['score']}")
        print(f"   Matched: {best['matched_tags']}")
        print(f"   Precision: {best['precision']:.2%}")
    
    # Select multiple
    print("\n" + "="*60)
    # print("\n📊 Top 3 videos:")
    reset_usage_tracker()
    # multiple = select_multiple_videos(matched_tags, count=3)
    
    # for i, vid in enumerate(multiple, 1):
    #     print(f"\n{i}. {vid['s3_key']}")
    #     print(f"   Score: {vid['score']}")
    #     print(f"   Matched: {vid['matched_tags']}")
    #     print(f"   Precision: {vid['precision']:.2%}")


# from typing import List, Tuple, Dict, Optional

# MatchedTag = Tuple[str, float]

# def score_video(video_tags, matched_tags):
#     score = 0.0
#     matched = []
    
#     matched_tag_map = dict(matched_tags)

#     for tag in video_tags:
#         if tag in matched_tag_map:
#             score += matched_tag_map[tag]
#             matched.append(tag)
#         else:
#             score -= 0.1  # penalty 

#     score += len(matched) * 0.15

#     return round(score, 3), matched


# def select_best_video(videos, matched_tags):
#     best_video = None
#     best_score = float("-inf")

#     matched_tag_set = {tag for tag, _ in matched_tags}

#     for video in videos:
#         video_tags = video.get("tags", [])
#         if not video_tags:
#             continue

#         score, matched = score_video(video_tags, matched_tags)

#         if not matched:
#             continue  # no semantic overlap at all

#         # 🔹 Soft relevance scaling instead of rejection
#         relevance_ratio = len(matched) / len(video_tags)
#         adjusted_score = score * (0.6 + relevance_ratio)

#         if adjusted_score > best_score:
#             best_score = adjusted_score
#             best_video = {
#                 **video,
#                 "score": round(adjusted_score, 3),
#                 "matched_tags": matched
#             }

#     return best_video





# from typing import List, Tuple, Dict

# MatchedTag = Tuple[str, float]


# def score_video(
#     video_tags: List[str],
#     matched_tags: List[MatchedTag]
# ) -> float:
#     score = 0.0
#     matched_count = 0

#     for tag, tag_score in matched_tags:
#         if tag in video_tags:
#             score += tag_score
#             matched_count += 1

#     # 🔹 Bonus for multiple matches
#     score += matched_count * 0.15

#     return round(score, 3)


# def select_best_video(
#     videos: List[Dict],
#     matched_tags: List[MatchedTag],
#     min_overlap: int = 1   # ✅ allow single-tag match
# ) -> Dict | None:

#     best_video = None
#     best_score = 0.0

#     for video in videos:
#         overlap = set(video["tags"]) & {t[0] for t in matched_tags}

#         if len(overlap) < min_overlap:
#             continue

#         score = score_video(video["tags"], matched_tags)

#         if score > best_score:
#             best_score = score
#             best_video = {
#                 **video,
#                 "score": score,
#                 "matched_tags": list(overlap)
#             }

#     # 🔹 Fallback: pick best partial match if nothing qualified
#     if not best_video:
#         for video in videos:
#             score = score_video(video["tags"], matched_tags)
#             if score > best_score:
#                 best_score = score
#                 best_video = {
#                     **video,
#                     "score": score,
#                     "matched_tags": []
#                 }

#     return best_video
