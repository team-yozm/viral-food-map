from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import asdict, dataclass, field
from typing import Any
from urllib.parse import urlparse

import httpx
from google import genai
from google.genai import types as genai_types

from config import settings
from detector.alias_manager import clean_display_keyword

logger = logging.getLogger(__name__)

VALID_CATEGORIES = ("디저트", "음료", "식사", "간식", "기타")
VALID_VERDICTS = ("accept", "reject", "review")

# Grounding / tool-capability error keywords used to trigger fallback.
_GROUNDING_ERROR_KEYWORDS = (
    "does not support",
    "not supported",
    "unsupported",
    "tool",
    "grounding",
    "capability",
    "FAILED_PRECONDITION",
    "INVALID_ARGUMENT",
)

_QUOTA_ERROR_KEYWORDS = (
    "429",
    "resource_exhausted",
    "rate limit",
    "quota",
    "billing detail",
    "too many requests",
)

_TIMEOUT_ERROR_KEYWORDS = (
    "504",
    "deadline_exceeded",
    "deadline exceeded",
    "deadline",
    "timeout",
    "timed out",
)

_TIMEOUT_RETRY_DELAY_SECONDS = 1.0


class AIReviewError(RuntimeError):
    """Raised when the AI review service cannot be used safely."""


@dataclass(slots=True)
class TrendReviewPayload:
    keyword: str
    acceleration: float
    search_volume_data: dict[str, float]
    blog_count: int
    ig_count: int | None
    category_hint: str
    evidence_snippets: list[str]


@dataclass(slots=True)
class DiscoveryReviewPayload:
    keyword: str
    frequency: int
    food_ratio: float
    category_hint: str
    evidence_snippets: list[str]


@dataclass(slots=True)
class TrendReviewResult:
    verdict: str
    confidence: float
    category: str
    reason: str
    canonical_keyword: str | None = None
    description: str | None = None
    model: str | None = None
    grounding_used: bool = False
    grounding_queries: list[str] = field(default_factory=list)
    grounding_sources: list[str] = field(default_factory=list)


@dataclass(slots=True)
class AIReviewGroundingTrace:
    used_google_search: bool = False
    web_search_queries: list[str] = field(default_factory=list)
    grounding_sources: list[str] = field(default_factory=list)


@dataclass(slots=True)
class GeminiTextResponse:
    text: str
    grounding_trace: AIReviewGroundingTrace | None = None


@dataclass(slots=True)
class InstagramImageReviewResult:
    verdict: str
    confidence: float
    reason: str
    detected_subject: str | None = None
    concerns: list[str] | None = None
    model: str | None = None


def is_ai_review_enabled() -> bool:
    return bool(
        settings.AI_REVIEW_ENABLED
        and settings.AI_REVIEW_API_KEY.strip()
        and settings.AI_REVIEW_MODEL.strip()
    )


def _get_client() -> genai.Client:
    return genai.Client(api_key=settings.AI_REVIEW_API_KEY)


def _normalize_verdict(value: Any) -> str:
    verdict = str(value or "").strip().lower()
    return verdict if verdict in VALID_VERDICTS else "review"


def _normalize_category(value: Any, fallback: str = "기타") -> str:
    category = str(value or "").strip()
    return category if category in VALID_CATEGORIES else fallback


def _normalize_keyword(value: Any, original_keyword: str) -> str | None:
    keyword = clean_display_keyword(str(value or ""))
    if not keyword or keyword == original_keyword:
        return None
    return keyword


def _normalize_description(value: Any, original_keyword: str) -> str | None:
    description = " ".join(str(value or "").split())
    if not description or description == original_keyword:
        return None
    if len(description) > 140:
        description = f"{description[:137].rstrip()}..."
    return description


def _extract_json_blob(content: str) -> dict[str, Any] | list[dict[str, Any]]:
    stripped = content.strip()
    if not stripped:
        raise AIReviewError("empty AI response")

    try:
        data = json.loads(stripped)
        if isinstance(data, (dict, list)):
            return data
    except json.JSONDecodeError:
        pass

    start_positions = [index for index in (stripped.find("{"), stripped.find("[")) if index >= 0]
    if not start_positions:
        raise AIReviewError("no JSON payload found in AI response")

    start = min(start_positions)
    end = max(stripped.rfind("}"), stripped.rfind("]"))
    if end < start:
        raise AIReviewError("incomplete JSON payload in AI response")

    try:
        data = json.loads(stripped[start : end + 1])
    except json.JSONDecodeError as exc:
        raise AIReviewError("invalid JSON payload in AI response") from exc

    if not isinstance(data, (dict, list)):
        raise AIReviewError("AI response JSON must be an object or list")
    return data


def _normalize_short_text(value: Any, max_length: int = 160) -> str | None:
    text = " ".join(str(value or "").split())
    if not text:
        return None
    if len(text) > max_length:
        text = f"{text[: max_length - 3].rstrip()}..."
    return text


def _normalize_concerns(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    concerns: list[str] = []
    for item in value:
        text = _normalize_short_text(item, max_length=80)
        if text:
            concerns.append(text)
        if len(concerns) >= 4:
            break
    return concerns


def _get_attr_or_key(value: Any, *names: str) -> Any:
    if value is None:
        return None

    if isinstance(value, dict):
        for name in names:
            if name in value:
                return value[name]

    for name in names:
        if hasattr(value, name):
            return getattr(value, name)

    return None


def _build_grounding_result_kwargs(
    grounding_trace: AIReviewGroundingTrace | None,
) -> dict[str, Any]:
    if grounding_trace is None:
        return {}

    return {
        "grounding_used": grounding_trace.used_google_search,
        "grounding_queries": list(grounding_trace.web_search_queries),
        "grounding_sources": list(grounding_trace.grounding_sources),
    }


def _format_grounding_source(chunk: Any) -> str | None:
    web = _get_attr_or_key(chunk, "web")
    if web is None:
        return None

    title = _normalize_short_text(_get_attr_or_key(web, "title"), max_length=90)
    uri = _normalize_short_text(_get_attr_or_key(web, "uri"), max_length=200)

    host = ""
    if uri:
        host = urlparse(uri).netloc.lower().removeprefix("www.")

    if title and host and host != "vertexaisearch.cloud.google.com":
        return f"{title} ({host})"
    if title:
        return title
    if host:
        return host
    return uri


def _extract_grounding_trace(
    response: genai_types.GenerateContentResponse,
) -> AIReviewGroundingTrace | None:
    queries: list[str] = []
    sources: list[str] = []
    used_google_search = False

    for candidate in response.candidates or []:
        grounding_metadata = _get_attr_or_key(
            candidate,
            "grounding_metadata",
            "groundingMetadata",
        )
        if grounding_metadata is None:
            continue

        candidate_queries = _get_attr_or_key(
            grounding_metadata,
            "web_search_queries",
            "webSearchQueries",
        ) or []
        candidate_chunks = _get_attr_or_key(
            grounding_metadata,
            "grounding_chunks",
            "groundingChunks",
        ) or []

        if candidate_queries or candidate_chunks:
            used_google_search = True

        for query in candidate_queries:
            normalized_query = _normalize_short_text(query, max_length=80)
            if normalized_query and normalized_query not in queries:
                queries.append(normalized_query)
            if len(queries) >= 5:
                break

        for chunk in candidate_chunks:
            source = _format_grounding_source(chunk)
            if source and source not in sources:
                sources.append(source)
            if len(sources) >= 5:
                break

    if not used_google_search and not queries and not sources:
        return None

    return AIReviewGroundingTrace(
        used_google_search=used_google_search or bool(queries or sources),
        web_search_queries=queries,
        grounding_sources=sources,
    )


def _coerce_result(
    raw: dict[str, Any],
    *,
    original_keyword: str,
    fallback_category: str,
    grounding_trace: AIReviewGroundingTrace | None = None,
) -> TrendReviewResult:
    try:
        confidence = float(raw.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(confidence, 1.0))

    reason = " ".join(str(raw.get("reason", "")).split())
    if not reason:
        reason = "reason missing"

    return TrendReviewResult(
        verdict=_normalize_verdict(raw.get("verdict")),
        confidence=confidence,
        category=_normalize_category(raw.get("category"), fallback=fallback_category),
        reason=reason[:200],
        canonical_keyword=_normalize_keyword(
            raw.get("canonical_keyword"),
            original_keyword=original_keyword,
        ),
        description=_normalize_description(
            raw.get("description"),
            original_keyword=original_keyword,
        ),
        model=settings.AI_REVIEW_MODEL,
        **_build_grounding_result_kwargs(grounding_trace),
    )


def _is_grounding_error(exc: Exception) -> bool:
    """Return True if the exception looks like a grounding/tool capability error."""
    return _has_error_keyword(exc, _GROUNDING_ERROR_KEYWORDS)


def _is_quota_error(exc: Exception) -> bool:
    """Return True if the exception looks like a quota/rate-limit error."""
    return _has_error_keyword(exc, _QUOTA_ERROR_KEYWORDS)


def _iter_exception_chain(exc: Exception):
    seen: set[int] = set()
    current: Exception | None = exc
    while current is not None and id(current) not in seen:
        yield current
        seen.add(id(current))
        next_exc = current.__cause__ or current.__context__
        current = next_exc if isinstance(next_exc, Exception) else None


def _has_error_keyword(exc: Exception, keywords: tuple[str, ...]) -> bool:
    lowered_keywords = tuple(keyword.lower() for keyword in keywords)
    return any(
        any(keyword in str(error).lower() for keyword in lowered_keywords)
        for error in _iter_exception_chain(exc)
    )


def _is_timeout_error(exc: Exception) -> bool:
    """Return True if the exception looks like a timeout/deadline issue."""
    return any(
        isinstance(error, (TimeoutError, httpx.TimeoutException))
        for error in _iter_exception_chain(exc)
    ) or _has_error_keyword(exc, _TIMEOUT_ERROR_KEYWORDS)


def _extract_response_text(response: genai_types.GenerateContentResponse) -> str:
    """Extract text content from a Gemini generate_content response."""
    if response.text:
        return response.text
    parts = []
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            if part.text:
                parts.append(part.text)
    return "\n".join(parts)


async def _gemini_generate(
    *,
    model: str,
    system_instruction: str,
    user_content: str | list[genai_types.Part],
    max_output_tokens: int = 1200,
    tools: list[genai_types.Tool] | None = None,
) -> GeminiTextResponse:
    """Call Gemini generate_content and return the text response with trace data."""
    if not is_ai_review_enabled():
        raise AIReviewError("AI review is disabled or missing credentials")

    client = _get_client()

    config = genai_types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.1,
        max_output_tokens=max_output_tokens,
        http_options=genai_types.HttpOptions(
            timeout=settings.AI_REVIEW_TIMEOUT_SECONDS * 1000,
        ),
    )
    if tools:
        config.tools = tools

    try:
        response = await client.aio.models.generate_content(
            model=model,
            contents=user_content,
            config=config,
        )
    except Exception as exc:
        raise AIReviewError(f"Gemini API request failed: {exc}") from exc

    text = _extract_response_text(response)
    if not text:
        raise AIReviewError("empty Gemini response")
    return GeminiTextResponse(
        text=text,
        grounding_trace=_extract_grounding_trace(response),
    )


async def _gemini_generate_with_grounding(
    *,
    system_instruction: str,
    user_content: str,
    max_output_tokens: int = 1200,
) -> GeminiTextResponse:
    """Call Gemini with Google Search grounding, with automatic fallback."""
    model = settings.AI_REVIEW_MODEL
    use_grounding = settings.AI_REVIEW_GROUNDING_ENABLED

    tools: list[genai_types.Tool] | None = None
    if use_grounding:
        tools = [genai_types.Tool(google_search=genai_types.GoogleSearch())]

    async def _call(model_name: str, *, grounded: bool) -> GeminiTextResponse:
        response = await _gemini_generate(
            model=model_name,
            system_instruction=system_instruction,
            user_content=user_content,
            max_output_tokens=max_output_tokens,
            tools=tools if grounded else None,
        )
        logger.info(
            "Gemini text review completed with model=%s, grounding=%s",
            model_name,
            grounded,
        )
        return response

    try:
        return await _call(model, grounded=use_grounding)
    except AIReviewError as exc:
        original_exc = exc.__cause__ or exc
        if not use_grounding:
            raise

        fallback_model = settings.AI_REVIEW_GROUNDING_FALLBACK_MODEL
        if _is_timeout_error(original_exc):
            logger.warning(
                "Grounded Gemini request timed out on %s, retrying without grounding: %s",
                model,
                original_exc,
            )
            await asyncio.sleep(_TIMEOUT_RETRY_DELAY_SECONDS)
            return await _call(model, grounded=False)

        if _is_grounding_error(original_exc):
            if fallback_model and fallback_model != model:
                logger.warning(
                    "Grounding not supported on %s, falling back to %s: %s",
                    model,
                    fallback_model,
                    original_exc,
                )
                try:
                    return await _call(fallback_model, grounded=True)
                except AIReviewError as fallback_exc:
                    fallback_original_exc = fallback_exc.__cause__ or fallback_exc
                    if _is_timeout_error(fallback_original_exc):
                        logger.warning(
                            "Grounded fallback request timed out on %s, retrying without grounding: %s",
                            fallback_model,
                            fallback_original_exc,
                        )
                        await asyncio.sleep(_TIMEOUT_RETRY_DELAY_SECONDS)
                        return await _call(fallback_model, grounded=False)
                    if not (
                        _is_grounding_error(fallback_original_exc)
                        or _is_quota_error(fallback_original_exc)
                    ):
                        raise
                    logger.warning(
                        "Grounded fallback request failed on %s, retrying without grounding: %s",
                        fallback_model,
                        fallback_original_exc,
                    )
                    return await _call(fallback_model, grounded=False)

            logger.warning(
                "Grounding not supported on %s, retrying without grounding: %s",
                model,
                original_exc,
            )
            return await _call(model, grounded=False)

        if _is_quota_error(original_exc):
            logger.warning(
                "Grounded Gemini request hit quota on %s, retrying without grounding: %s",
                model,
                original_exc,
            )
            return await _call(model, grounded=False)

        raise


async def _request_text_review(
    *,
    system_prompt: str,
    payload: dict[str, Any],
) -> tuple[dict[str, Any] | list[dict[str, Any]], AIReviewGroundingTrace | None]:
    """Text review via Gemini with grounding."""
    response = await _gemini_generate_with_grounding(
        system_instruction=system_prompt,
        user_content=json.dumps(payload, ensure_ascii=False),
    )
    return _extract_json_blob(response.text), response.grounding_trace


def _extract_results(raw: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]

    results = raw.get("results")
    if isinstance(results, list):
        return [item for item in results if isinstance(item, dict)]

    raise AIReviewError("AI response missing results array")


def _fallback_result_map(
    payloads: list[TrendReviewPayload] | list[DiscoveryReviewPayload],
    *,
    grounding_trace: AIReviewGroundingTrace | None = None,
) -> dict[str, TrendReviewResult]:
    results: dict[str, TrendReviewResult] = {}
    for payload in payloads:
        results[payload.keyword] = TrendReviewResult(
            verdict="review",
            confidence=0.0,
            category=payload.category_hint,
            reason="result missing",
            description=None,
            model=settings.AI_REVIEW_MODEL,
            **_build_grounding_result_kwargs(grounding_trace),
        )
    return results


def _coerce_result_map(
    raw: dict[str, Any] | list[dict[str, Any]],
    *,
    payloads: list[TrendReviewPayload] | list[DiscoveryReviewPayload],
    grounding_trace: AIReviewGroundingTrace | None = None,
) -> dict[str, TrendReviewResult]:
    payload_map = {payload.keyword: payload for payload in payloads}
    result_map = _fallback_result_map(payloads, grounding_trace=grounding_trace)

    for item in _extract_results(raw):
        keyword = clean_display_keyword(item.get("keyword"))
        payload = payload_map.get(keyword)
        if payload is None:
            continue
        result_map[keyword] = _coerce_result(
            item,
            original_keyword=payload.keyword,
            fallback_category=payload.category_hint,
            grounding_trace=grounding_trace,
        )

    return result_map


async def review_trend_candidates(
    payloads: list[TrendReviewPayload],
) -> dict[str, TrendReviewResult]:
    if not payloads:
        return {}

    system_prompt = (
        "You are reviewing Korean viral food trend candidates for a store-finding service. "
        "You will receive multiple candidates at once. "
        "Accept only if the keyword is a specific food, drink, dessert, snack, or menu concept "
        "that users may search for and buy nearby right now. "
        "Reject keywords that are non-food, too generic, just a restaurant descriptor, a place, "
        "a person, a content format, or a promotion phrase. "
        "Use review when the keyword is food-related but too generic or uncertain for automatic approval. "
        "If multiple candidates refer to the same food using abbreviation, spacing variation, or synonym, "
        "set canonical_keyword so they point to the same normalized expression. "
        "Prefer the most common consumer-facing expression among the provided candidates when deciding a canonical cluster. "
        "For accepted keywords, also write a short Korean description for end users in 1-2 sentences. "
        "The description should briefly explain what the food is and why people are looking for it now. "
        "Keep it factual, concise, and avoid markdown, quotes, hashtags, and fabricated numbers. "
        "For reject or review verdicts, description can be an empty string. "
        "Category must be one of: 디저트, 음료, 식사, 간식, 기타. "
        "Respond with JSON only using the shape "
        '{"results":[{"keyword":"...","verdict":"accept|reject|review","confidence":0.0,"category":"...","reason":"...","canonical_keyword":"...","description":"..."}]}.'
    )
    raw, grounding_trace = await _request_text_review(
        system_prompt=system_prompt,
        payload={
            "type": "trend_candidates",
            "candidates": [asdict(payload) for payload in payloads],
        },
    )
    result_map = _coerce_result_map(
        raw,
        payloads=payloads,
        grounding_trace=grounding_trace,
    )
    logger.info(
        "AI trend batch reviewed %s candidates (google_search=%s, queries=%s, sources=%s)",
        len(payloads),
        bool(grounding_trace and grounding_trace.used_google_search),
        len(grounding_trace.web_search_queries) if grounding_trace else 0,
        len(grounding_trace.grounding_sources) if grounding_trace else 0,
    )
    return result_map


async def review_discovered_keywords(
    payloads: list[DiscoveryReviewPayload],
) -> dict[str, TrendReviewResult]:
    if not payloads:
        return {}

    system_prompt = (
        "You are reviewing newly discovered Korean food keywords for a monitoring list. "
        "You will receive multiple candidates at once. "
        "Accept only if the keyword is a distinct food or drink concept worth tracking as its own keyword. "
        "Reject keywords that are too generic, non-food, location terms, broad category names, marketing terms, "
        "or content trend words. Use review for borderline food keywords that should not be auto-added. "
        "If multiple candidates refer to the same food using abbreviation, spacing variation, or synonym, "
        "set canonical_keyword so they point to the same normalized expression. "
        "Prefer the most common consumer-facing expression among the provided candidates when deciding a canonical cluster. "
        "Category must be one of: 디저트, 음료, 식사, 간식, 기타. "
        "Respond with JSON only using the shape "
        '{"results":[{"keyword":"...","verdict":"accept|reject|review","confidence":0.0,"category":"...","reason":"...","canonical_keyword":"..."}]}.'
    )
    raw, grounding_trace = await _request_text_review(
        system_prompt=system_prompt,
        payload={
            "type": "discovered_keywords",
            "candidates": [asdict(payload) for payload in payloads],
        },
    )
    result_map = _coerce_result_map(
        raw,
        payloads=payloads,
        grounding_trace=grounding_trace,
    )
    logger.info(
        "AI discovery batch reviewed %s candidates (google_search=%s, queries=%s, sources=%s)",
        len(payloads),
        bool(grounding_trace and grounding_trace.used_google_search),
        len(grounding_trace.web_search_queries) if grounding_trace else 0,
        len(grounding_trace.grounding_sources) if grounding_trace else 0,
    )
    return result_map


def _coerce_instagram_image_result(
    raw: dict[str, Any] | list[dict[str, Any]],
) -> InstagramImageReviewResult:
    if isinstance(raw, list):
        raise AIReviewError("Instagram image review must return a JSON object")

    payload = raw.get("result") if isinstance(raw.get("result"), dict) else raw

    try:
        confidence = float(payload.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(confidence, 1.0))

    reason = _normalize_short_text(payload.get("reason"), max_length=200) or "reason missing"

    return InstagramImageReviewResult(
        verdict=_normalize_verdict(payload.get("verdict")),
        confidence=confidence,
        reason=reason,
        detected_subject=_normalize_short_text(
            payload.get("detected_subject"),
            max_length=120,
        ),
        concerns=_normalize_concerns(payload.get("concerns")),
        model=settings.AI_REVIEW_MODEL,
    )


async def review_instagram_post_image(
    *,
    image_url: str,
    trend_name: str,
    category: str | None = None,
    caption: str | None = None,
) -> InstagramImageReviewResult:
    if not image_url.strip():
        raise AIReviewError("Instagram image review requires a public image URL")

    system_prompt = (
        "You are reviewing a single Instagram feed image for a Korean viral food trend service. "
        "Approve only if the image is suitable for publishing as a food trend post about the named menu. "
        "The main subject should clearly show the food or drink itself, a plated serving, packaged product, "
        "or another close and trustworthy visual of that exact menu. "
        "Reject storefront exteriors, street scenes, unrelated interiors, people-focused photos, posters, "
        "menu boards, screenshots, collages, heavy watermarks, blurry images, or images where the named food "
        "is not visible enough. Use review when the image might be related but is too ambiguous for automatic posting. "
        "Be strict and prefer review over accept when uncertain. "
        "Respond with JSON only using the shape "
        '{"verdict":"accept|reject|review","confidence":0.0,"reason":"...","detected_subject":"...","concerns":["..."]}.'
    )

    review_context = {
        "trend_name": trend_name,
        "category": category or "",
        "caption": caption or "",
    }

    # Download image bytes for Gemini multimodal input
    try:
        async with httpx.AsyncClient(timeout=settings.AI_REVIEW_TIMEOUT_SECONDS) as http:
            img_response = await http.get(image_url)
            img_response.raise_for_status()
            image_bytes = img_response.content
            content_type = img_response.headers.get("content-type", "image/jpeg")
    except Exception as exc:
        raise AIReviewError(f"Failed to download image for review: {exc}") from exc

    # Determine MIME type
    mime_type = content_type.split(";")[0].strip()
    if mime_type not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
        mime_type = "image/jpeg"

    user_parts = [
        genai_types.Part.from_text(
            text="Review this Instagram feed image before auto-publishing.\n"
            f"{json.dumps(review_context, ensure_ascii=False)}"
        ),
        genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
    ]

    # Image review: no grounding, just multimodal
    response = await _gemini_generate(
        model=settings.AI_REVIEW_MODEL,
        system_instruction=system_prompt,
        user_content=user_parts,
        max_output_tokens=400,
    )

    raw = _extract_json_blob(response.text)
    result = _coerce_instagram_image_result(raw)
    logger.info(
        "AI Instagram image reviewed %s as %s (confidence=%.2f)",
        trend_name,
        result.verdict,
        result.confidence,
    )
    return result
