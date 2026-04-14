from __future__ import annotations

import re
from collections import defaultdict
from typing import Iterable

DISPLAY_WHITESPACE_RE = re.compile(r"\s+")
NORMALIZE_RE = re.compile(r"[^0-9A-Za-z\uAC00-\uD7A3]+")


def clean_display_keyword(value: str | None) -> str:
    return DISPLAY_WHITESPACE_RE.sub(" ", str(value or "")).strip()


def normalize_keyword_text(value: str | None) -> str:
    cleaned = clean_display_keyword(value).lower()
    return NORMALIZE_RE.sub("", cleaned)


def build_alias_pair_key(term_a: str | None, term_b: str | None) -> str | None:
    normalized_terms = sorted(
        {
            normalize_keyword_text(term)
            for term in (term_a, term_b)
            if normalize_keyword_text(term)
        }
    )
    if len(normalized_terms) != 2:
        return None
    return "::".join(normalized_terms)


def parse_alias_decisions(
    alias_rows: list[dict],
) -> tuple[set[str], dict[str, str]]:
    """Extract blocked pairs and merge overrides from rows with decision_type.

    Returns (blocked_pairs, merge_overrides) where merge_overrides maps
    pair_key to canonical_keyword display string.
    """
    blocked: set[str] = set()
    merges: dict[str, str] = {}
    for row in alias_rows:
        decision_type = str(row.get("decision_type") or "").strip().lower()
        if decision_type not in {"merge", "separate"}:
            continue
        pair_key = build_alias_pair_key(row.get("alias"), row.get("canonical_keyword"))
        if not pair_key:
            continue
        if decision_type == "separate":
            blocked.add(pair_key)
        else:
            canonical = clean_display_keyword(row.get("canonical_keyword"))
            if canonical:
                merges[pair_key] = canonical
    return blocked, merges


def build_alias_lookup(alias_rows: list[dict]) -> dict[str, str]:
    blocked, merges = parse_alias_decisions(alias_rows)
    lookup: dict[str, str] = {}

    for row in alias_rows:
        if str(row.get("decision_type") or "").strip().lower() == "separate":
            continue
        alias_key = row.get("alias_normalized") or normalize_keyword_text(
            row.get("alias")
        )
        canonical = clean_display_keyword(row.get("canonical_keyword"))
        if not alias_key or not canonical:
            continue
        pair_key = build_alias_pair_key(row.get("alias"), canonical)
        if pair_key and pair_key in blocked:
            continue
        if pair_key and pair_key in merges:
            canonical = merges[pair_key]
        canonical_key = normalize_keyword_text(canonical)
        if canonical_key and alias_key != canonical_key:
            lookup[alias_key] = canonical

    return lookup


def build_alias_terms_by_canonical(alias_rows: list[dict]) -> dict[str, list[str]]:
    alias_lookup = build_alias_lookup(alias_rows)

    display_names: dict[str, str] = {}
    for row in alias_rows:
        key = row.get("alias_normalized") or normalize_keyword_text(row.get("alias"))
        display = clean_display_keyword(row.get("alias"))
        if key and display:
            display_names[key] = display

    terms_by_canonical: dict[str, list[str]] = defaultdict(list)
    for alias_key, canonical in alias_lookup.items():
        display = display_names.get(alias_key, alias_key)
        terms_by_canonical[canonical].append(display)

    deduped: dict[str, list[str]] = {}
    for canonical, terms in terms_by_canonical.items():
        deduped[canonical] = dedupe_terms([canonical, *terms])
    return deduped


def filter_alias_rows(
    alias_rows: list[dict],
    blocked_pairs: set[str],
) -> list[dict]:
    """Filter new alias rows by removing blocked pairs before upserting."""
    if not blocked_pairs:
        return alias_rows
    return [
        row
        for row in alias_rows
        if build_alias_pair_key(row.get("alias"), row.get("canonical_keyword"))
        not in blocked_pairs
    ]


def get_effective_canonical_keyword(
    source_keyword: str,
    suggested_keyword: str | None,
    alias_lookup: dict[str, str],
    blocked_pairs: set[str],
) -> str | None:
    cleaned_suggested = clean_display_keyword(suggested_keyword)
    if not cleaned_suggested:
        return None
    source_key = normalize_keyword_text(source_keyword)
    suggested_key = normalize_keyword_text(cleaned_suggested)
    if not source_key or not suggested_key or source_key == suggested_key:
        return None

    pair_key = build_alias_pair_key(source_keyword, cleaned_suggested)
    if pair_key and pair_key in blocked_pairs:
        return None

    existing = alias_lookup.get(source_key)
    if existing:
        return existing

    return cleaned_suggested


def resolve_keyword_alias(
    keyword: str,
    alias_lookup: dict[str, str],
) -> tuple[str, bool]:
    cleaned = clean_display_keyword(keyword)
    canonical_keyword = alias_lookup.get(normalize_keyword_text(cleaned))
    if not canonical_keyword:
        return cleaned, False
    return canonical_keyword, canonical_keyword != cleaned


def dedupe_terms(terms: Iterable[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for term in terms:
        cleaned = clean_display_keyword(term)
        key = normalize_keyword_text(cleaned)
        if not cleaned or not key or key in seen:
            continue
        seen.add(key)
        deduped.append(cleaned)
    return deduped


def build_alias_rows(
    canonical_keyword: str,
    aliases: Iterable[str],
    *,
    confidence: float | None,
    source_job: str,
) -> list[dict]:
    rows: list[dict] = []
    cleaned_canonical = clean_display_keyword(canonical_keyword)
    canonical_key = normalize_keyword_text(cleaned_canonical)
    if not cleaned_canonical or not canonical_key:
        return rows

    for alias in dedupe_terms(aliases):
        alias_key = normalize_keyword_text(alias)
        if not alias_key or alias_key == canonical_key:
            continue
        rows.append(
            {
                "alias": alias,
                "alias_normalized": alias_key,
                "canonical_keyword": cleaned_canonical,
                "canonical_normalized": canonical_key,
                "confidence": confidence,
                "source_job": source_job,
            }
        )

    return rows


def get_canonicalization_label(source: str, target: str) -> str | None:
    source_keyword = clean_display_keyword(source)
    target_keyword = clean_display_keyword(target)
    if not source_keyword or not target_keyword or source_keyword == target_keyword:
        return None
    return f"{source_keyword} -> {target_keyword}"
