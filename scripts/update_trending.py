#!/usr/bin/env python3
"""
GitHub Actions 版：每日抓取 GitHub Trending，生成 github_trending.json。

数据源：
1. github.com/trending?since=daily HTML 解析（主）
2. GitHub Search API 补充（近7天新创高星）
中文点评：GitHub Models 单次批量调用（GITHUB_TOKEN），失败自动降级为无点评版，
保证 github_trending.json 必产出。

输出：仓库根目录 github_trending.json（由 workflow 负责 commit+push）
"""

import json
import math
import os
import re
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

REPO = "seoj07617-stack/shiyi-app"
TZ8 = timezone(timedelta(hours=8))
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

VALID_CATS = {"AI", "工具", "好玩"}
VALID_TAGS = {"爆火", "实用", "新奇"}
REQUIRED_FIELDS = {"repo", "name", "desc", "desc_cn", "cat", "lang",
                   "stars", "today", "url", "tag"}


# ── HTTP helpers (stdlib only) ─────────────────────────────
def http_get(url, headers=None, timeout=25):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def http_post_json(url, payload, headers=None, timeout=90):
    data = json.dumps(payload).encode("utf-8")
    h = {"Content-Type": "application/json"}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def gh_headers():
    h = {
        "Authorization": f"token {os.environ.get('GITHUB_TOKEN', '')}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "shiyi-trending-actions",
    }
    return h


# ── Formatting ─────────────────────────────────────────────
def format_stars(n: int) -> str:
    if n >= 1000:
        v = n // 1000
        return f"{v}k" if n // 100 == v * 10 or True else f"{n // 1000}k"
    return str(n)


def format_today(n: int) -> str:
    if abs(n) >= 1000:
        v = n / 1000
        return f"+{int(v)}k" if v == int(v) else f"+{v:.1f}k"
    return f"+{n}"


# ── Source 1: Trending HTML ────────────────────────────────
def fetch_trending_page() -> list:
    url = "https://github.com/trending?since=daily"
    try:
        html = http_get(url, headers={"User-Agent": UA})
    except Exception as e:
        print(f"[WARN] trending page failed: {e}")
        return []

    rows = re.findall(r'<article class="Box-row">(.*?)</article>', html, re.DOTALL)
    print(f"trending articles: {len(rows)}")

    repos = []
    for row in rows:
        m = re.search(r'<h2[^>]*>\s*<a[^>]*href="(/[^"]+)"', row, re.DOTALL)
        if not m:
            continue
        parts = m.group(1).strip().lstrip("/").split("/")
        if len(parts) < 2:
            continue
        full_name = f"{parts[0]}/{parts[1]}"

        dm = re.search(r'<p class="col-9[^"]*">\s*(.*?)\s*</p>', row, re.DOTALL)
        desc = re.sub(r"<[^>]+>", "", dm.group(1)).strip() if dm else ""

        lm = re.search(r'itemprop="programmingLanguage">(.*?)<', row)
        lang = lm.group(1).strip() if lm else ""

        stars_m = re.findall(r'class="[^"]*octicon-star[^"]*".*?</svg>\s*([\d,]+)', row, re.DOTALL)
        total = int(stars_m[0].replace(",", "")) if len(stars_m) >= 1 else 0
        today = int(stars_m[1].replace(",", "")) if len(stars_m) >= 2 else 0

        repos.append({
            "repo": full_name, "name": parts[1],
            "desc": desc[:200], "lang": lang,
            "stars": total, "today": today,
            "url": f"https://github.com/{full_name}", "source": "trending",
        })
    return repos


# ── Source 2: Search API ───────────────────────────────────
def fetch_search_api() -> list:
    now = datetime.now(TZ8)
    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")

    repos, seen = [], set()
    queries = [
        f"created:>{week_ago} stars:>100",
        f"created:>{week_ago} stars:>30 stars:<5000",
    ]
    for q in queries:
        try:
            qs = urllib.parse.urlencode({
                "q": q, "sort": "stars", "order": "desc", "per_page": 20,
            })
            raw = http_get(f"https://api.github.com/search/repositories?{qs}",
                           headers=gh_headers())
            data = json.loads(raw)
            for item in data.get("items", []):
                full = item.get("full_name", "")
                if full in seen:
                    continue
                seen.add(full)
                stars = item.get("stargazers_count", 0)
                created = item.get("created_at", "")
                today_est = 0
                try:
                    dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    age = (now - dt).total_seconds() / 86400
                    if age < 7 and stars > 100:
                        today_est = int(stars / max(age, 1))
                except Exception:
                    pass
                repos.append({
                    "repo": full, "name": full.split("/")[-1],
                    "desc": (item.get("description") or "")[:200],
                    "lang": item.get("language") or "",
                    "stars": stars, "today": today_est,
                    "url": f"https://github.com/{full}", "source": "search",
                })
        except Exception as e:
            print(f"[WARN] search '{q}' failed: {e}")
    return repos


# ── Merge & select ─────────────────────────────────────────
def merge_and_select(trending, search):
    seen, merged = set(), []
    for r in trending:
        if r["repo"] not in seen:
            seen.add(r["repo"])
            merged.append(r)
    for r in search:
        if r["repo"] not in seen and r["today"] > 0:
            seen.add(r["repo"])
            merged.append(r)

    def score(r):
        return r["today"] * 3 + math.sqrt(r["stars"])

    merged.sort(key=score, reverse=True)
    if len(merged) < 10:
        for r in search:
            if r["repo"] not in seen:
                seen.add(r["repo"])
                merged.append(r)
                if len(merged) >= 12:
                    break
        merged.sort(key=score, reverse=True)
    return merged[:12]


# ── LLM enrichment via Pollinations (keyless, single batched call) ──
POLLINATIONS_URL = "https://text.pollinations.ai/"
POLLINATIONS_MODELS = ["openai-fast", "openai"]


def pollinations_call(selected):
    """单次批量调用 Pollinations 免费文本 API 生成中文点评。
    返回 list[{desc_cn,cat,tag}] 或 None。"""
    listing = "\n".join(
        f"{i}. {r['repo']} | {r['name']} | lang={r['lang'] or 'NA'} | "
        f"stars={r['stars']} | today=+{r['today']} | desc: {r['desc'] or 'NA'}"
        for i, r in enumerate(selected)
    )
    prompt = f"""为以下 {len(selected)} 个 GitHub 开源项目各生成一条中文点评。项目列表：
{listing}

要求：
1. desc_cn：15-40字，说明项目用途和亮点
2. cat：只能是 AI / 工具 / 好玩 之一（AI=人工智能相关，工具=开发/效率工具，好玩=创意/演示/游戏）
3. tag：只能是 爆火 / 实用 / 新奇 之一（爆火仅限 today>+5000 或 stars>100k 的现象级项目，严格限定）
4. 严格输出 JSON 数组，不要任何其他文字：[{{"i":0,"desc_cn":"...","cat":"...","tag":"..."}}, ...]"""

    last_err = None
    for model in POLLINATIONS_MODELS:
        for attempt in range(2):
            try:
                print(f"pollinations attempt: model={model} try={attempt}")
                payload = {
                    "messages": [{"role": "user", "content": prompt}],
                    "model": model,
                    "referrer": "shiyi-trending",
                }
                req = urllib.request.Request(
                    POLLINATIONS_URL,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=150) as resp:
                    content = resp.read().decode("utf-8", errors="replace").strip()
                print(f"  resp len={len(content)} head={content[:100]!r}")
                if not content:
                    raise ValueError("empty response")
                raw_text = content
                if raw_text.lstrip().startswith("{"):
                    try:
                        obj = json.loads(raw_text)
                        if isinstance(obj, dict):
                            raw_text = str(obj.get("content") or obj.get("message")
                                           or obj.get("text") or raw_text)
                    except Exception:
                        pass
                raw_text = re.sub(r"```(?:json)?", "", raw_text)
                # tolerant per-item parse: every flat {...} with desc_cn
                out = {}
                for mm in re.finditer(r"\{[^{}]*\}", raw_text, re.DOTALL):
                    try:
                        e = json.loads(mm.group(0))
                    except Exception:
                        continue
                    if not isinstance(e, dict) or "desc_cn" not in e:
                        continue
                    try:
                        idx = int(e.get("i", -1))
                    except Exception:
                        continue
                    if 0 <= idx < len(selected):
                        out[idx] = {
                            "desc_cn": str(e.get("desc_cn", "")).strip(),
                            "cat": str(e.get("cat", "")).strip(),
                            "tag": str(e.get("tag", "")).strip(),
                        }
                if len(out) < max(6, len(selected) // 2):
                    raise ValueError(f"too few parsed: {len(out)}/{len(selected)}")
                print(f"pollinations OK via {model} ({len(out)} items)")
                return [out.get(i) for i in range(len(selected))]
            except Exception as e:
                last_err = e
                print(f"[WARN] pollinations {model} try{attempt}: {type(e).__name__}: {e}")
                time.sleep(5)
    print(f"[WARN] all pollinations attempts failed: {last_err}")
    return None


# ── Degraded annotation ────────────────────────────────────
def degrade(selected):
    out = []
    for r in selected:
        d = (r["desc"] or "").lower()
        if re.search(r"\b(ai|llm|gpt|agent|rag|model|ml)\b", d) or r["name"].lower() in (
                "llm", "gpt", "agent"):
            cat = "AI"
        elif re.search(r"(game|demo|visual|fun|ascii|pixel|art)", d):
            cat = "好玩"
        else:
            cat = "工具"
        tag = "爆火" if (r["today"] > 5000 and r["stars"] > 50000) else "实用"
        out.append({"desc_cn": r["desc"] or r["name"], "cat": cat, "tag": tag})
    return out


# ── Build & validate ───────────────────────────────────────
def build_items(selected, notes):
    items = []
    for r, n in zip(selected, notes):
        desc_cn = (n["desc_cn"] or "").strip()
        cat = n["cat"] if n["cat"] in VALID_CATS else "工具"
        tag = n["tag"] if n["tag"] in VALID_TAGS else "实用"
        if not desc_cn:
            desc_cn = (r["desc"] or "")[:40] or "开源项目"
        items.append({
            "repo": r["repo"], "name": r["name"],
            "desc": (r["desc"] or "")[:120],
            "desc_cn": desc_cn[:60], "cat": cat,
            "lang": r["lang"] or "",
            "stars": format_stars(r["stars"]),
            "today": format_today(r["today"]),
            "url": r["url"], "tag": tag,
        })
    return items


def validate(items, today):
    if len(items) < 8:
        raise SystemExit(f"[FAIL] items too few: {len(items)} < 8")
    for i, it in enumerate(items):
        missing = REQUIRED_FIELDS - set(it.keys())
        if missing:
            raise SystemExit(f"[FAIL] items[{i}] missing: {missing}")
        if it["cat"] not in VALID_CATS:
            raise SystemExit(f"[FAIL] items[{i}].cat invalid: {it['cat']}")
        if it["tag"] not in VALID_TAGS:
            raise SystemExit(f"[FAIL] items[{i}].tag invalid: {it['tag']}")
    print(f"validate OK: {len(items)} items for {today}")


# ── Main ───────────────────────────────────────────────────
def main():
    today = datetime.now(TZ8).strftime("%Y-%m-%d")
    now_iso = datetime.now(TZ8).isoformat(timespec="seconds")

    print("[1/4] fetching trending page...")
    trending = fetch_trending_page()
    print(f"  got {len(trending)}")

    print("[2/4] fetching search api...")
    search = fetch_search_api()
    print(f"  got {len(search)}")

    selected = merge_and_select(trending, search)
    print(f"[3/4] selected {len(selected)} repos")

    notes = pollinations_call(selected)
    mode = "llm" if notes else "degraded"
    if not notes:
        print("  [DEGRADED] models unavailable, using keyword fallback")
        notes = degrade(selected)

    items = build_items(selected, notes)
    validate(items, today)

    out = {"date": today, "updated": now_iso, "mode": mode, "items": items}
    with open("github_trending.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"[4/4] written github_trending.json (mode={mode}, {len(items)} items)")


if __name__ == "__main__":
    main()
