import os
import time
import json
from typing import List, Tuple, Dict
from google import genai
from google.genai import errors, types
from dotenv import load_dotenv
load_dotenv()

# config
MODEL_NAME = "models/gemini-2.5-flash"  
TEMPERATURE = 0.20
TOP_P = 0.9
MAX_OUTPUT_TOKENS = 2048
MAX_RETRIES = 3
INITIAL_BACKOFF = 2.0

CORE_SCORE = 0.70
SUPPORT_SCORE = 0.50
WEAK_SCORE = 0.35

MAX_TAGS = 8
MAX_WEAK_TAGS = 1

client = genai.Client(api_key=os.getenv("VITE_GEMINI_API_KEY"))

MatchedTag = Tuple[str, float]
TagDef = Dict[str, str]


def extract_json_from_response(response) -> dict:
    """
    Improved JSON extraction with multiple fallback strategies.
    """
    if not response.candidates:
        raise ValueError("No candidates returned")

    candidate = response.candidates[0]

    if not candidate.content or not candidate.content.parts:
        raise ValueError("No content parts returned")

    # Strategy 1: Try structured_data first (preferred for response_schema)
    for part in candidate.content.parts:
        if hasattr(part, "structured_data") and part.structured_data:
            # Convert to dict if needed
            if hasattr(part.structured_data, '__dict__'):
                return dict(part.structured_data)
            return part.structured_data

    # Strategy 2: Extract text and parse as JSON
    text_content = ""
    for part in candidate.content.parts:
        if hasattr(part, "text") and part.text:
            text_content += part.text

    if text_content:
        text_content = text_content.strip()
        
        if text_content.startswith("```"):
            lines = text_content.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text_content = "\n".join(lines).strip()
        
        try:
            return json.loads(text_content)
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON decode error: {e}")
            print(f"Raw text: {text_content[:200]}...")
            raise ValueError(f"Failed to parse JSON: {e}")

    raise ValueError("No parseable content found in response")


def dedupe_tags(tags: List[MatchedTag]) -> List[MatchedTag]:
    seen = {}
    for tag, score in tags:
        root = tag.split("_")[0]
        if root not in seen or score > seen[root][1]:
            seen[root] = (tag, score)
    return list(seen.values())


def enforce_tag_diversity(tags: List[MatchedTag]) -> List[MatchedTag]:
    GENERIC_TAGS = {"corporate", "business", "lifestyle", "productivity", "technology"}

    specific, generic = [], []
    for tag, score in tags:
        (generic if tag in GENERIC_TAGS else specific).append((tag, score))

    return specific + generic[:2]


def match_tags_with_gemini(
    script: str,
    tags: List[TagDef],
    max_tags: int = MAX_TAGS,
) -> List[MatchedTag]:

    tag_list = "\n".join([f"- {t['id']}: {t['text']}" for t in tags])
    valid_ids = {t["id"] for t in tags}

    prompt = f"""You are analyzing a video script to select the most relevant visual and thematic tags.

YOUR TASK:
Identify tags that represent:
1. PRIMARY THEMES: Core topics and concepts discussed
2. VISUAL ELEMENTS: Settings, objects, actions that would appear on screen
3. CONTEXT: Industry, tone, use case, and implied visuals

SELECTION CRITERIA:
✓ Tag MUST be directly supported by script content or implied visuals
✓ Consider what a viewer would SEE and HEAR
✓ Pay close attention to domain-specific language (medical, business, tech, etc.)
✓ "Teams" can mean: medical teams, business teams, sports teams - choose based on context
✓ If the script mentions health/medical concepts, prioritize healthcare tags
✓ Exclude generic tags unless they're the primary focus
✓ ONLY use tags from the provided list below - do not create new tags

SCORING GUIDE:
0.9-1.0 = Central theme OR dominant visual element (appears throughout)
0.7-0.8 = Major supporting concept OR frequent visual
0.5-0.6 = Secondary theme OR occasional visual element
0.3-0.4 = Brief mention OR background element
Below 0.3 = Don't include

ANALYZE THIS SCRIPT:

SCRIPT:
\"\"\"
{script}
\"\"\"

AVAILABLE TAGS (use ONLY these):
{tag_list}

THINK STEP-BY-STEP:
1. Identify KEY PHRASES that indicate the domain (e.g., "healthcare", "business", "finance", "technology")
2. What is the main subject/topic? (highest scores)
3. What would viewers SEE in the video? (visual elements like hospitals, offices, labs)
4. What industry/context is this? (healthcare, business, sports, education, etc.)
5. What supporting concepts are present? (lower scores)
6. Which available tags DON'T fit? (exclude these - be strict)

IMPORTANT: 
- Only select tags that exist in the available tags list above
- Do not invent or suggest new tags
- If uncertain between two industries, choose based on the most specific keywords
- "AI" or "technology" should only be tagged if the script explicitly discusses technology

Return a valid JSON object with this exact structure:
{{
  "tags": [
    {{"id": "tag_name", "score": 0.95}},
    {{"id": "another_tag", "score": 0.80}}
  ]
}}

Use 3-7 tags typically. Be selective and precise. Return ONLY the JSON, no other text."""

    # Simplified response schema
    response_schema = {
        "type": "OBJECT",
        "properties": {
            "tags": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "id": {"type": "STRING"},
                        "score": {"type": "NUMBER"}
                    },
                    "required": ["id", "score"]
                }
            }
        },
        "required": ["tags"]
    }

    backoff = INITIAL_BACKOFF

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"🔄 Attempt {attempt}/{MAX_RETRIES}...")
            
            config = types.GenerateContentConfig(
                temperature=TEMPERATURE,
                top_p=TOP_P,
                max_output_tokens=MAX_OUTPUT_TOKENS,
                response_mime_type="application/json",
                response_schema=response_schema,
            )

            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config=config,
            )

            try:
                data = extract_json_from_response(response)
                print(f"✅ Successfully extracted JSON: {len(data.get('tags', []))} tags found")
            except Exception as e:
                print(f"⚠️ JSON extraction failed (attempt {attempt}): {e}")
                if attempt < MAX_RETRIES:
                    print(f"   Retrying in {backoff}s...")
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                print("❌ All JSON extraction attempts failed")
                return []

            results: List[MatchedTag] = []

            for t in data.get("tags", []):
                tag_id = t.get("id")
                score = t.get("score")

                if not tag_id or not isinstance(score, (int, float)):
                    print(f"⚠️ Skipping invalid tag: {t}")
                    continue

                if tag_id not in valid_ids:
                    print(f"⚠️ Skipping unknown tag ID: {tag_id}")
                    continue

                score = min(max(float(score), 0.0), 1.0)
                if score >= 0.3:
                    results.append((tag_id, score))
                    print(f"   ✓ {tag_id}: {score:.2f}")

            if results:
                results = dedupe_tags(results)
                results = enforce_tag_diversity(results)
                results.sort(key=lambda x: x[1], reverse=True)
                final_results = results[:max_tags]
                print(f"✅ Returning {len(final_results)} tags after filtering")
                return final_results

            print(f"⚠️ No valid tags found (attempt {attempt})")
            if attempt < MAX_RETRIES:
                print(f"   Retrying in {backoff}s...")
                time.sleep(backoff)
                backoff *= 2

        except errors.ClientError as e:
            # Handle quota/rate limit errors (429)
            error_code = getattr(e, 'code', None) or getattr(e, 'status_code', None)
            error_message = str(e)
            
            if '429' in error_message or 'RESOURCE_EXHAUSTED' in error_message or 'quota' in error_message.lower():
                print(f"❌ QUOTA EXCEEDED (attempt {attempt})")
                print(f"   Error: {error_message[:200]}")
                
                # Extract retry delay if available
                if 'retry in' in error_message.lower():
                    # Try to extract the retry delay
                    import re
                    match = re.search(r'retry in (\d+\.?\d*)', error_message.lower())
                    if match:
                        wait_time = float(match.group(1)) + 1  
                    else:
                        wait_time = 60
                else:
                    wait_time = 60
                
                print(f"   ⏳ You've hit the Gemini API rate limit.")
                print(f"   💡 Solutions:")
                print(f"      1. Wait {wait_time}s and try again")
                print(f"      2. Check your quota at: https://ai.dev/rate-limit")
                print(f"      3. Consider upgrading your API plan")
                print(f"      4. Use a different model (try gemini-1.5-flash-8b)")
                
                if attempt < MAX_RETRIES:
                    print(f"   Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                else:
                    print("❌ Max retries reached. Please check your quota and try again later.")
                    return []
            else:
                print(f"❌ Client error: {e}")
                raise

        except errors.ServerError as e:
            print(f"⚠️ Server error (attempt {attempt}): {e}")
            if attempt < MAX_RETRIES:
                print(f"   Retrying in {backoff}s...")
                time.sleep(backoff)
                backoff *= 2
            else:
                print("❌ Server unavailable after all retries")

        except Exception as e:
            print(f"❌ Unexpected error (attempt {attempt}): {type(e).__name__}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(backoff)
                backoff *= 2
            else:
                raise

    print("❌ All attempts failed")
    return []


def filter_tags_no_types(tag_results: List[MatchedTag]) -> List[MatchedTag]:
    if not tag_results:
        return []

    strong, medium, weak = [], [], []

    for tag, score in tag_results:
        if score >= CORE_SCORE:
            strong.append((tag, score))
        elif score >= SUPPORT_SCORE:
            medium.append((tag, score))
        elif score >= WEAK_SCORE:
            weak.append((tag, score))

    if strong:
        selected = strong + medium[:3]
    elif medium:
        selected = medium[:4]
    else:
        selected = weak[:MAX_WEAK_TAGS]

    selected = dedupe_tags(selected)
    selected.sort(key=lambda x: x[1], reverse=True)

    return selected[:MAX_TAGS]