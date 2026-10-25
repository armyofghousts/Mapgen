"""Warhammer Fantasy Wiki (MediaWiki) client with retries and relevance checks."""

from __future__ import annotations

import html
import os
import re
import time
from typing import Any
from urllib.parse import quote

import requests

DEFAULT_API_URL = "https://warhammerfantasy.fandom.com/api.php"
DEFAULT_TIMEOUT = 8.0
DEFAULT_RETRIES = 1  # one retry => two attempts total
TRANSIENT_STATUS = {429, 500, 502, 503, 504}
STOPWORDS = {"the", "a", "an", "of", "and", "or", "in", "on", "to", "for"}


class WikiError(Exception):
    """Raised when the wiki API cannot be reached or returns invalid data."""


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return max(0, int(raw))
    except ValueError:
        return default


def wiki_config() -> dict[str, Any]:
    return {
        "api_url": os.environ.get("WIKI_API_URL", DEFAULT_API_URL).strip() or DEFAULT_API_URL,
        "timeout": _env_float("WIKI_TIMEOUT", DEFAULT_TIMEOUT),
        "retries": _env_int("WIKI_MAX_RETRIES", DEFAULT_RETRIES),
        "user_agent": os.environ.get(
            "WIKI_USER_AGENT",
            "mapgen-school-project/1.0 (Warhammer Fantasy map encyclopedia)",
        ).strip(),
    }


def _normalize(text: str) -> str:
    text = text.casefold().strip()
    text = re.sub(r"[^\w\s-]", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def _tokens(text: str) -> set[str]:
    return {t for t in _normalize(text).split() if t and t not in STOPWORDS}


def is_relevant_match(query: str, title: str, snippet: str = "") -> bool:
    """
    Avoid treating an unrelated first hit as a match.
    Accepts exact/near title matches, or strong token overlap with title/snippet.
    """
    q = _normalize(query)
    t = _normalize(title)
    if not q or not t:
        return False
    if q == t:
        return True
    if t.startswith(q) or q.startswith(t):
        return True
    if q in t or t in q:
        return True

    q_tokens = _tokens(query)
    if not q_tokens:
        return False

    title_tokens = _tokens(title)
    snippet_tokens = _tokens(re.sub(r"<[^>]+>", " ", snippet or ""))
    haystack = title_tokens | snippet_tokens
    overlap = q_tokens & haystack
    # Require most query tokens to appear; short queries need a full hit.
    needed = len(q_tokens) if len(q_tokens) <= 2 else max(2, (len(q_tokens) + 1) // 2)
    return len(overlap) >= needed


def pick_best_search_hit(query: str, hits: list[dict]) -> dict | None:
    """Pick the best relevant search hit; return None if none look related."""
    if not hits:
        return None

    scored: list[tuple[int, dict]] = []
    for hit in hits:
        title = str(hit.get("title") or "")
        snippet = str(hit.get("snippet") or "")
        if not is_relevant_match(query, title, snippet):
            continue
        qn = _normalize(query)
        tn = _normalize(title)
        if qn == tn:
            score = 100
        elif tn.startswith(qn) or qn.startswith(tn):
            score = 80
        elif qn in tn:
            score = 60
        else:
            score = 40 + len(_tokens(query) & _tokens(title))
        scored.append((score, hit))

    if not scored:
        return None
    scored.sort(key=lambda item: item[0], reverse=True)
    return scored[0][1]


def _request_json(params: dict[str, Any]) -> dict[str, Any]:
    cfg = wiki_config()
    headers = {
        "User-Agent": cfg["user_agent"],
        "Accept": "application/json",
    }
    attempts = 1 + int(cfg["retries"])
    last_error: Exception | None = None

    for attempt in range(attempts):
        try:
            response = requests.get(
                cfg["api_url"],
                params=params,
                headers=headers,
                timeout=cfg["timeout"],
            )
        except requests.Timeout as exc:
            last_error = WikiError("Wiki request timed out.")
            if attempt + 1 < attempts:
                time.sleep(0.4 * (attempt + 1))
                continue
            raise last_error from exc
        except requests.RequestException as exc:
            last_error = WikiError(f"Could not reach the wiki: {exc}")
            if attempt + 1 < attempts:
                time.sleep(0.4 * (attempt + 1))
                continue
            raise last_error from exc

        if response.status_code in TRANSIENT_STATUS:
            last_error = WikiError(
                f"Wiki temporarily unavailable (HTTP {response.status_code})."
            )
            if attempt + 1 < attempts:
                retry_after = response.headers.get("Retry-After")
                delay = 0.5 * (attempt + 1)
                if retry_after:
                    try:
                        delay = max(delay, min(float(retry_after), 5.0))
                    except ValueError:
                        pass
                time.sleep(delay)
                continue
            raise last_error

        if response.status_code >= 400:
            raise WikiError(f"Wiki request failed (HTTP {response.status_code}).")

        try:
            payload = response.json()
        except ValueError as exc:
            raise WikiError("Wiki returned an invalid (non-JSON) response.") from exc

        if not isinstance(payload, dict):
            raise WikiError("Wiki returned an unexpected JSON shape.")
        if "error" in payload:
            info = payload["error"]
            message = info.get("info") if isinstance(info, dict) else str(info)
            raise WikiError(f"Wiki API error: {message}")
        return payload

    raise last_error or WikiError("Wiki request failed.")


def search_pages(query: str, limit: int = 8) -> list[dict]:
    payload = _request_json(
        {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "srlimit": max(1, min(limit, 20)),
            "srprop": "snippet|titlesnippet",
            "format": "json",
        }
    )
    query_block = payload.get("query")
    if not isinstance(query_block, dict):
        return []
    results = query_block.get("search")
    if not isinstance(results, list):
        return []
    return [item for item in results if isinstance(item, dict)]


def _plain_text_from_html(markup: str) -> str:
    text = re.sub(r"<[^>]+>", " ", markup)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip(" -\u2014\u2013")


def short_description_from_html(markup: str, limit: int = 420) -> str:
    """
    Fandom wikis often lack TextExtracts; derive a short blurb from parsed HTML.
    Skips quotes/infoboxes so we keep a real article intro when possible.
    """
    cleaned = markup or ""
    for tag in ("blockquote", "table", "aside", "nav", "figure", "style", "script", "sup"):
        cleaned = re.sub(rf"<{tag}\b[^>]*>.*?</{tag}>", " ", cleaned, flags=re.I | re.S)

    cleaned = re.sub(r"<br\s*/?>", "\n", cleaned, flags=re.I)
    candidates: list[str] = []
    for part in re.split(r"</p>", cleaned, flags=re.I):
        text = _plain_text_from_html(part)
        if len(text) < 60:
            continue
        if text.startswith(('"', "\u201c", "—", "-")):
            continue
        candidates.append(text)

    if not candidates:
        fallback = _plain_text_from_html(cleaned)
        if not fallback:
            return "No short description available."
        return fallback[:limit].rstrip() + ("…" if len(fallback) > limit else "")

    blurb = candidates[0]
    if len(blurb) > limit:
        blurb = blurb[: limit - 1].rstrip() + "…"
    return blurb


def fetch_page_summary(pageid: int) -> dict[str, Any] | None:
    # Prefer parse+info: this Fandom wiki does not expose TextExtracts.
    info_payload = _request_json(
        {
            "action": "query",
            "prop": "info",
            "pageids": str(pageid),
            "inprop": "url",
            "format": "json",
        }
    )
    query_block = info_payload.get("query")
    if not isinstance(query_block, dict):
        raise WikiError("Wiki info response was missing query data.")
    pages = query_block.get("pages")
    if not isinstance(pages, dict) or not pages:
        return None
    page = next(iter(pages.values()))
    if not isinstance(page, dict) or page.get("missing") is not None:
        return None

    title = str(page.get("title") or "").strip()
    url = str(page.get("fullurl") or "").strip()
    if not url and title:
        cfg = wiki_config()
        base = cfg["api_url"].removesuffix("/api.php").rstrip("/")
        url = f"{base}/wiki/{quote(title.replace(' ', '_'))}"

    parse_payload = _request_json(
        {
            "action": "parse",
            "pageid": str(pageid),
            "prop": "text",
            "format": "json",
            "disableeditsection": 1,
        }
    )
    parse_block = parse_payload.get("parse")
    if not isinstance(parse_block, dict):
        raise WikiError("Wiki parse response was invalid.")
    html_block = parse_block.get("text")
    markup = ""
    if isinstance(html_block, dict):
        markup = str(html_block.get("*") or "")
    elif isinstance(html_block, str):
        markup = html_block

    return {
        "title": title or str(parse_block.get("title") or "").strip(),
        "description": short_description_from_html(markup),
        "url": url,
        "pageid": page.get("pageid", pageid),
    }


def lookup_location(query: str) -> dict[str, Any]:
    """
    Search the wiki for a location name and return a UI-friendly payload.
    Never blindly trusts the first hit if it looks unrelated.
    """
    name = (query or "").strip()
    if not name:
        return {
            "ok": True,
            "found": False,
            "message": "Enter a location name before loading wiki info.",
        }

    hits = search_pages(name)
    best = pick_best_search_hit(name, hits)
    if not best:
        return {
            "ok": True,
            "found": False,
            "message": (
                f'No matching Warhammer Fantasy Wiki article was found for “{name}”. '
                "Try a more specific place name (for example Kislev, Altdorf, or Praag)."
            ),
            "query": name,
        }

    pageid = best.get("pageid")
    try:
        pageid_int = int(pageid)
    except (TypeError, ValueError) as exc:
        raise WikiError("Wiki search result was missing a valid page id.") from exc

    summary = fetch_page_summary(pageid_int)
    if not summary or not summary.get("title"):
        return {
            "ok": True,
            "found": False,
            "message": f'A wiki hit was found for “{name}”, but its article could not be loaded.',
            "query": name,
        }

    # Re-check relevance against the resolved article title.
    if not is_relevant_match(name, summary["title"], summary.get("description", "")):
        return {
            "ok": True,
            "found": False,
            "message": (
                f'Wiki results for “{name}” did not look related enough to show. '
                "Rename the location closer to the wiki article title, then try again."
            ),
            "query": name,
        }

    return {
        "ok": True,
        "found": True,
        "query": name,
        "title": summary["title"],
        "description": summary["description"],
        "url": summary["url"],
        "pageid": summary.get("pageid"),
    }
