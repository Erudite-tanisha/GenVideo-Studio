import json
from llm_tags import match_tags_with_gemini, filter_tags_no_types

with open("tags.json") as f:
    TAGS = json.load(f)

def get_matched_tags(script: str):
    raw = match_tags_with_gemini(script, TAGS)
    # print("RAW:", raw)
    return filter_tags_no_types(raw)

if __name__ == "__main__":
    script = """
    In healthcare, AI is becoming a second set of eyes for doctors by helping medical teams catch what the human eye simply can’t.
    """

    matches = get_matched_tags(script)

    print("Matched tags:")
    for tag, score in matches:
        print(tag, round(score, 3))


# import numpy as np
# from model import load_model

# model = load_model()

# tag_embeddings = np.load("tag_embeddings.npy")
# tag_ids = np.load("tag_ids.npy", allow_pickle=True)

# LEXICAL_BOOST = 1.25   # safe boost, not too aggressive
# MIN_SCORE = 0.25
# MIN_TAGS = 10
# MAX_TAGS = 15

# def match_tags(script):
#     script_lower = script.lower()

#     # Encode script
#     script_emb = model.encode([script], normalize_embeddings=True)[0]

#     # Cosine similarity
#     similarities = tag_embeddings @ script_emb

#     tag_scores = []

#     for i, base_score in enumerate(similarities):
#         tag_id = tag_ids[i]
#         score = float(base_score)

#         # 🔹 Lexical / phrase boost
#         tag_phrase = tag_id.replace("_", " ")

#         if tag_phrase in script_lower:
#             score *= LEXICAL_BOOST

#         tag_scores.append((tag_id, score))

#     # 🔹 Sort by boosted score
#     tag_scores.sort(key=lambda x: x[1], reverse=True)

#     # 🔹 Keep all tags above minimum score
#     selected = [(tag, score) for tag, score in tag_scores if score >= MIN_SCORE]

#     # 🔹 Ensure minimum number of tags
#     if len(selected) < MIN_TAGS:
#         selected = tag_scores[:MIN_TAGS]

#     return selected[:MAX_TAGS]

# # Test
# if __name__ == "__main__":
#     script = "It does not go to Perplexity. It goes straight to Gemini. Now here is where it gets wild."
#     matches = match_tags(script)

#     print("Matched tags:")
#     for tag, score in matches:
#         print(tag, round(score, 3))
