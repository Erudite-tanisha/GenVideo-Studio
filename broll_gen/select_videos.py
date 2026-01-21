from typing import List, Tuple, Dict, Optional
from collections import defaultdict

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
            # Small penalty for irrelevant tags
            score -= 0.05

    # Must have at least one match
    if not matched:
        return 0.0, []

    # Bonus for multiple matches (diminishing returns)
    if len(matched) > 1:
        match_bonus = min(len(matched) * 0.10, 0.40)
        score += match_bonus

    # Calculate precision: what % of video tags are relevant?
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
    videos: List[Dict],
    matched_tags: List[MatchedTag],
    exclude_videos: Optional[List[str]] = None,
    min_tag_overlap: int = 1
) -> Optional[Dict]:
    """
    Select the best matching video with diversity enforcement.
    """
    
    if not videos or not matched_tags:
        return None

    exclude_videos = exclude_videos or []
    best_video = None
    best_score = 0.0
    
    for video in videos:
        video_key = video.get("s3_key")
        video_tags = video.get("tags", [])
        
        # Skip if excluded or no tags
        if not video_tags or video_key in exclude_videos:
            continue

        # Calculate score
        score, matched = score_video(video_tags, matched_tags, video_key)

        # Skip if no overlap or below minimum
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

    # Track usage
    if best_video:
        VIDEO_USAGE_TRACKER[best_video["s3_key"]] += 1

    return best_video


def select_multiple_videos(
    videos: List[Dict],
    matched_tags: List[MatchedTag],
    count: int = 3,
    min_tag_overlap: int = 1
) -> List[Dict]:
    """
    Select multiple diverse videos for a script.
    """
    selected = []
    exclude = []
    
    for _ in range(count):
        video = select_best_video(
            videos, 
            matched_tags, 
            exclude_videos=exclude,
            min_tag_overlap=min_tag_overlap
        )
        
        if not video:
            break
            
        selected.append(video)
        exclude.append(video["s3_key"])
    
    return selected


def reset_usage_tracker():
    """Reset usage tracking (call at session start/end)."""
    VIDEO_USAGE_TRACKER.clear()


# Example usage
if __name__ == "__main__":
    # Sample videos
    videos = [
        {"s3_key": "r1v1.mov", "tags": ["home", "corporate", "lifestyle", "education"]},
        {"s3_key": "r1v3.mov", "tags": ["home", "corporate", "lifestyle", "education", "productivity", "consulting", "coding"]},
        {"s3_key": "Coding_1.mov", "tags": ["ai", "technology"]},
        {"s3_key": "r1v117.mov", "tags": ["marketing", "corporate", "collaboration"]},
        {"s3_key": "r1v78.mov", "tags": ["finance", "corporate", "lifestyle"]},
    ]
    
    # Tags from script analysis
    matched_tags = [
        ("ai", 0.85),
        ("coding", 0.80),
        ("productivity", 0.50)
    ]
    
    print("Matched tags:", matched_tags)
    print("\n" + "="*60)
    
    # Select best video
    best = select_best_video(videos, matched_tags)
    if best:
        print(f"\nBest video: {best['s3_key']}")
        print(f"Score: {best['score']}")
        print(f"Matched: {best['matched_tags']}")
        print(f"Precision: {best['precision']:.2%}")
    
    # Select multiple
    print("\n" + "="*60)
    print("\nTop 3 videos:")
    reset_usage_tracker()  # Reset for fair comparison
    multiple = select_multiple_videos(videos, matched_tags, count=3)
    
    for i, vid in enumerate(multiple, 1):
        print(f"\n{i}. {vid['s3_key']}")
        print(f"   Score: {vid['score']}")
        print(f"   Matched: {vid['matched_tags']}")
        print(f"   Precision: {vid['precision']:.2%}")


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
