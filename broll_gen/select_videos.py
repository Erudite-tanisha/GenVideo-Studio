from typing import List, Tuple, Dict, Optional

MatchedTag = Tuple[str, float]

def score_video(video_tags, matched_tags):
    score = 0.0
    matched = []
    
    matched_tag_map = dict(matched_tags)

    for tag in video_tags:
        if tag in matched_tag_map:
            score += matched_tag_map[tag]
            matched.append(tag)
        else:
            score -= 0.1  # penalty 

    # Bonus for multiple strong matches
    score += len(matched) * 0.15

    return round(score, 3), matched


def select_best_video(videos, matched_tags):
    best_video = None
    best_score = float("-inf")

    matched_tag_set = {tag for tag, _ in matched_tags}

    for video in videos:
        video_tags = video.get("tags", [])
        if not video_tags:
            continue

        score, matched = score_video(video_tags, matched_tags)

        if not matched:
            continue  # no semantic overlap at all

        # 🔹 Soft relevance scaling instead of rejection
        relevance_ratio = len(matched) / len(video_tags)
        adjusted_score = score * (0.6 + relevance_ratio)

        if adjusted_score > best_score:
            best_score = adjusted_score
            best_video = {
                **video,
                "score": round(adjusted_score, 3),
                "matched_tags": matched
            }

    return best_video





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
