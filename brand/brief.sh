#!/bin/sh
# 세션 시작 브리핑 — 이 저장소에 축적된 브랜드 기억의 현재 상태를 출력합니다.
# .claude/settings.json 의 SessionStart 훅이 자동으로 실행합니다.
# 수동 실행: sh brand/brief.sh

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT" || exit 0

echo "🧠 브랜드 기억장치 (brand/)"
echo "─────────────────────────────────────────────"
echo "브랜딩·카피·디자인 작업 전에 brand/INDEX.md 를 읽으세요."
echo "작업 후에는 배운 것을 brand/ 에 반영하고 brand/LOG.md 에 기록하세요."
echo

# 최근 세션 로그 3건의 제목만
echo "▸ 최근 작업 기록 (brand/LOG.md)"
if [ -f brand/LOG.md ]; then
  grep '^## ' brand/LOG.md | grep -v 'YYYY' | head -3 | sed 's/^## /   • /'
else
  echo "   (없음)"
fi
echo

# 아직 처리되지 않은 미해결 과제
echo "▸ 남은 일 (미체크 항목)"
UNDONE=$(grep -rh '^\s*- \[ \]' brand/*.md 2>/dev/null | head -5 | sed 's/^\s*- \[ \]/   ☐/')
if [ -n "$UNDONE" ]; then
  echo "$UNDONE"
else
  echo "   (없음)"
fi
echo

# inbox 에 분석 대기 중인 원본이 있는지
PENDING=$(find brand/inbox -type f ! -name 'README.md' 2>/dev/null | head -5)
if [ -n "$PENDING" ]; then
  echo "▸ ⚠️  분석 대기 중인 자료가 brand/inbox/ 에 있습니다"
  echo "$PENDING" | sed 's/^/   📄 /'
  echo "   → 분석해서 brand/sources/ 로 정리하세요."
  echo
fi

echo "─────────────────────────────────────────────"
