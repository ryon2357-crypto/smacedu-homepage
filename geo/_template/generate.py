"""강사별 개인 AI GEO 프로필 페이지 생성기.

geo/data/{slug}.json 을 읽어 geo/_template/template.html 에 채워서
geo/{slug}/index.html 을 만든다. smacedu-homepage는 git push = 배포이므로
--push를 주면 생성한 파일만 add/commit/push까지 한다([[project_smacedu_homepage_deploy]]
참고 — git add -A로 다른 세션의 미관련 변경까지 쓸어담지 않도록 항상 파일명 지정).

사용:
    python geo/_template/generate.py elanvital
    python geo/_template/generate.py elanvital --push
"""
import argparse
import html
import json
import re
import subprocess
import sys
from pathlib import Path
from string import Template

HERE = Path(__file__).resolve().parent
GEO_DIR = HERE.parent
REPO_ROOT = GEO_DIR.parent
DATA_DIR = GEO_DIR / "data"
TEMPLATE_PATH = HERE / "template.html"
SITE_BASE = "https://www.smacedu.kr"


def strip_tags(s: str) -> str:
    s = re.sub(r"</(li|p|div)>", ". ", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\.\s*\.", ".", s)
    return s


def build_stats_html(stats: list[dict]) -> str:
    lines = []
    for s in stats:
        lines.append(
            f'      <div class="stat"><b>{html.escape(s["value"])}</b>'
            f'<span>{html.escape(s["label"])}</span></div>'
        )
    return "\n".join(lines)


def build_faq_html(faq: list[dict]) -> str:
    blocks = []
    for i, item in enumerate(faq):
        open_attr = " open" if i == 0 else ""
        blocks.append(
            f'    <details{open_attr}>\n'
            f'      <summary>{html.escape(item["q"])}</summary>\n'
            f'      <div class="a-body">{item["a_html"]}</div>\n'
            f'    </details>'
        )
    return "\n\n".join(blocks)


def build_links_html(links: list[dict]) -> str:
    out = []
    for l in links:
        cls = ' class="secondary"' if not l.get("primary") else ""
        target = ' target="_blank" rel="noopener"' if l.get("external") else ""
        out.append(f'      <a{cls} href="{html.escape(l["href"])}"{target}>{html.escape(l["label"])}</a>')
    return "\n".join(out)


def build_person_jsonld(data: dict, canonical_url: str) -> str:
    obj = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": data["name"],
        "alternateName": data.get("alt_name", ""),
        "jobTitle": data["role"],
        "worksFor": {
            "@type": "Organization",
            "name": data.get("org_name", "스마트미디어아트센터"),
            "url": data.get("org_url", f"{SITE_BASE}/"),
        },
        "email": f"mailto:{data['email']}",
        "sameAs": data.get("same_as", []),
        "description": strip_tags(data["intro"]),
    }
    return json.dumps(obj, ensure_ascii=False, indent=2)


def build_faqpage_jsonld(faq: list[dict]) -> str:
    obj = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": item["q"],
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": item.get("a_text") or strip_tags(item["a_html"]),
                },
            }
            for item in faq
        ],
    }
    return json.dumps(obj, ensure_ascii=False, indent=2)


def render(slug: str) -> Path:
    data_path = DATA_DIR / f"{slug}.json"
    data = json.loads(data_path.read_text(encoding="utf-8"))

    canonical_url = f"{SITE_BASE}/geo/{slug}"
    template = Template(TEMPLATE_PATH.read_text(encoding="utf-8"))

    out = template.substitute(
        TITLE_TAG=data["title_tag"],
        META_DESC=data["meta_description"],
        OG_TITLE=data.get("og_title", data["title_tag"]),
        OG_DESC=data.get("og_description", data["meta_description"]),
        CANONICAL_URL=canonical_url,
        OG_IMAGE=data.get("og_image", f"{SITE_BASE}/images/director.jpg"),
        EYEBROW=data["eyebrow"],
        DISPLAY_NAME=data["display_name"],
        ROLE=data["role"],
        ORG=data["org"],
        INTRO=data["intro"],
        STATS_HTML=build_stats_html(data["stats"]),
        FAQ_HTML=build_faq_html(data["faq"]),
        CONTACT_LABEL=data.get("contact_label", "출강·강의 문의"),
        EMAIL=data["email"],
        LINKS_HTML=build_links_html(data["links"]),
        FOOTER=data.get("footer", data["display_name"]),
        PERSON_JSONLD=build_person_jsonld(data, canonical_url),
        FAQPAGE_JSONLD=build_faqpage_jsonld(data["faq"]),
    )

    out_dir = GEO_DIR / slug
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "index.html"
    out_path.write_text(out, encoding="utf-8")
    return out_path


def push(slug: str, out_path: Path) -> None:
    rel = out_path.relative_to(REPO_ROOT).as_posix()
    subprocess.run(["git", "add", rel], cwd=REPO_ROOT, check=True)
    commit = subprocess.run(
        ["git", "commit", "-m",
         f"geo: {slug} 프로필 페이지 생성/갱신\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"],
        cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    print(commit.stdout.strip())
    if commit.returncode != 0:
        print(commit.stderr.strip())
        if "nothing to commit" in (commit.stdout + commit.stderr):
            print("변경 없음 — 이미 최신 상태")
            return
        sys.exit(commit.returncode)
    push_result = subprocess.run(
        ["git", "push", "origin", "main"],
        cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    print(push_result.stdout.strip())
    print(push_result.stderr.strip())
    if push_result.returncode != 0:
        sys.exit(push_result.returncode)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", help="geo/data/{slug}.json 의 slug")
    ap.add_argument("--push", action="store_true", help="생성한 파일만 add/commit/push")
    args = ap.parse_args()

    out_path = render(args.slug)
    print(f"생성됨: {out_path}")
    print(f"주소: {SITE_BASE}/geo/{args.slug}")

    if args.push:
        push(args.slug, out_path)


if __name__ == "__main__":
    main()
