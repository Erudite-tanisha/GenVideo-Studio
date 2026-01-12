import os
import json
import re
import time
from typing import List, Tuple, Dict

from google import genai
from google.genai import errors

MODEL_NAME = "models/gemini-2.5-flash"
MAX_RETRIES = 4
INITIAL_BACKOFF = 1.5

CORE_SCORE = 0.75
SUPPORT_SCORE = 0.60
WEAK_SCORE = 0.45

MIN_TAGS = 7
MAX_TAGS = 10
MAX_WEAK_TAGS = 2

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

MatchedTag = Tuple[str, float]
TagDef = Dict[str, str]   # {"id": "...", "text": "..."}


def extract_json(text: str) -> dict:
    """
    Extract JSON object from Gemini output (handles markdown fences).
    """
    text = text.strip()

    text = re.sub(r"^```json|```$", "", text, flags=re.IGNORECASE).strip()

    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("No JSON found in Gemini response")

    return json.loads(match.group())


def dedupe_tags(tags: List[MatchedTag]) -> List[MatchedTag]:
    seen = set()
    result = []

    for tag, score in tags:
        root = tag.split("_")[0]
        if root not in seen:
            seen.add(root)
            result.append((tag, score))

    return result


def match_tags_with_gemini(
    script: str,
    tags: List[TagDef],
    min_tags: int = MIN_TAGS,
    max_tags: int = MAX_TAGS,
) -> List[MatchedTag]:

    tag_block = json.dumps(tags, indent=2)
    valid_ids = {t["id"] for t in tags}

    prompt = f"""
You are a semantic tagging system for B-roll video selection.

Rules:
- Choose ONLY from the provided tag IDs
- Prefer domain, concept, environment tags
- Avoid emotions unless clearly implied
- Return {min_tags}–{max_tags} tags
- Scores between 0.0 and 1.0
- Output JSON ONLY

Script:
\"\"\"
{script}
\"\"\"

Allowed tags:
{tag_block}

Output format:
{{
  "tags": [
    {{ "id": "ai", "score": 0.85 }}
  ]
}}
"""
    backoff = INITIAL_BACKOFF

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
            )
            data = extract_json(response.text)
            results: List[MatchedTag] = []

            for t in data.get("tags", []):
                tag_id = t.get("id")
                score = t.get("score")

                if tag_id in valid_ids and isinstance(score, (int, float)):
                    score = min(max(float(score), 0.0), 1.0)
                    results.append((tag_id, score))

            results.sort(key=lambda x: x[1], reverse=True)

            # Enforce bounds in code, not just prompt
            return results[:max_tags]

        except errors.ServerError:
            if attempt == MAX_RETRIES:
                break
            time.sleep(backoff)
            backoff *= 2

        except Exception:
            break

    # -------- FALLBACK --------
    return [
        ("ai", 0.6),
        ("technology", 0.55),
        ("software", 0.5),
    ]

# ---------------- FILTERING ----------------

def filter_tags_no_types(tag_results: List[MatchedTag]) -> List[MatchedTag]:
    strong, medium, weak = [], [], []

    for tag, score in tag_results:
        if score >= CORE_SCORE:
            strong.append((tag, score))
        elif score >= SUPPORT_SCORE:
            medium.append((tag, score))
        elif score >= WEAK_SCORE:
            weak.append((tag, score))

    strong.sort(key=lambda x: x[1], reverse=True)
    medium.sort(key=lambda x: x[1], reverse=True)
    weak.sort(key=lambda x: x[1], reverse=True)

    selected = strong + medium

    if len(selected) < MIN_TAGS:
        selected.extend(weak[:MAX_WEAK_TAGS])

    selected = dedupe_tags(selected)

    return selected[:MAX_TAGS]
