"""회원 전용 자료실 API(api/members.js)를 만든다.
- 스마트폰 사진 글: 문서함 대시보드 파일에서 사진 관련 5개 분류만 넣는다.
- AI 프롬프트 모음: scripts/members_prompts.json + scripts/members_codex_cards.txt(10/11 코덱스 무료특강 지시문 카드)
- 강의 자료 다운로드: DOWNLOADS 목록. 실제 파일은 Supabase 비공개 버킷 member-files에 올려 두고,
  회원에게만 10분짜리 서명 링크를 준다. 파일을 바꾸면 버킷에 같은 이름으로 다시 올린다.
다시 만들 때: python scripts/build_members_api.py <대시보드 html 경로>"""
import json, re, sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent
KEEP = ["촬영 팁", "계절·장소별 촬영 팁", "보정·앱", "영상 촬영·편집", "촬영 사례·출사기"]
src = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
rows = json.loads(re.search(r"const DATA=(\[.*?\]);\n", src, re.S).group(1))
posts = [{"id": r["id"], "title": " ".join(r["title"].split()), "date": r["date"], "type": r["type"], "sum": (r.get("sum") or "").strip()}
         for r in rows if r["type"] in KEEP]
posts.sort(key=lambda p: p["date"], reverse=True)
photo = {"types": KEEP, "posts": posts}

prompts = json.loads((HERE / "members_prompts.json").read_text(encoding="utf-8"))
cards_txt = (HERE / "members_codex_cards.txt").read_text(encoding="utf-8-sig")
cards = []
for m in re.finditer(r"=+\n카드 (\d+)\. (.+?)\n=+\n(.*?)(?=\n=+\n카드 |\Z)", cards_txt, re.S):
    cards.append({"title": m.group(2).strip(), "when": "코덱스에 작업을 맡길 때 · 10월 11일 코덱스 무료 특강 지시문 카드 " + m.group(1) + "번",
                  "text": m.group(3).strip()})
assert len(cards) == 8, len(cards)
prompts["groups"].append({"name": "코덱스 작업 지시 카드", "items": cards})

downloads = [
    {"key": "codex-practice-kit-20261011.zip", "name": "엘란비탈 코덱스 특강 실습자료 20261011.zip", "title": "코덱스 특강 실습자료 묶음",
     "desc": "어지러운 폴더 정리, 한 페이지 홈페이지 만들기, 신청서 점검 자동화를 그대로 따라 해 보는 연습용 가상 자료입니다. 압축을 풀고 복사본에서 연습하세요.",
     "from": "10월 11일 코덱스 무료 특강", "size": "6.3MB", "type": "ZIP"},
    {"key": "codex-agents-template-20261010.md", "name": "AGENTS_강의용_템플릿.md", "title": "코덱스 AGENTS.md 강의용 템플릿",
     "desc": "코덱스가 내 프로젝트에서 늘 지킬 규칙을 적어 두는 문서의 기본 틀입니다. 대괄호 항목만 내 상황에 맞게 바꿔 쓰면 됩니다.",
     "from": "10월 11일 코덱스 무료 특강", "size": "11KB", "type": "MD"},
    {"key": "codex-prompt-cards-20261011.txt", "name": "코덱스_지시문_카드.txt", "title": "코덱스 지시문 카드 8장",
     "desc": "폴더 점검부터 홈페이지 만들기, 신청서 자동화까지 그대로 복사해 쓰는 지시문 모음입니다.",
     "from": "10월 11일 코덱스 무료 특강", "size": "4KB", "type": "TXT"},
]

js = r"""// 회원 전용 자료실 API — scripts/build_members_api.py가 만든다(직접 고치지 말 것)
// GET /api/members?item=photo-posts   비회원: 분류마다 2편 / 회원: 전체
// GET /api/members?item=prompts       비회원: 묶음마다 1개 / 회원: 전체
// GET /api/members?item=downloads     목록(누구나) — 다운로드 주소는 없음
// GET /api/members?item=download&file=KEY   회원만: 10분짜리 서명 링크
const PHOTO = __PHOTO__;
const PROMPTS = __PROMPTS__;
const DOWNLOADS = __DOWNLOADS__;
const BUCKET = 'member-files';

function photoView(member) {
  const counts = {}, sample = [];
  for (const t of PHOTO.types) {
    const list = PHOTO.posts.filter(p => p.type === t);
    counts[t] = list.length;
    sample.push(...list.slice(0, 2));
  }
  return { member, total: PHOTO.posts.length, types: PHOTO.types, counts, posts: member ? PHOTO.posts : sample };
}

function promptView(member) {
  const total = PROMPTS.groups.reduce((n, g) => n + g.items.length, 0);
  const groups = PROMPTS.groups.map(g => ({ name: g.name, count: g.items.length, items: member ? g.items : g.items.slice(0, 1) }));
  return { member, total, intro: PROMPTS.intro, groups };
}

function downloadList(member) {
  return { member, files: DOWNLOADS.map(({ key, title, desc, from, size, type }) => ({ key, title, desc, from, size, type })) };
}

async function getMember(auth) {
  if (!auth) return { member: false };
  if (!/^Bearer \S+$/.test(auth)) return { error: [401, '로그인이 필요합니다.'] };
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!base || !key) return { error: [503, '회원 인증 서비스를 확인해 주세요.'] };
  try {
    const r = await fetch(base + '/auth/v1/user', { headers: { apikey: key, Authorization: auth }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { error: [401, '다시 로그인해 주세요.'] };
    const user = await r.json();
    if (!user.id || user.is_anonymous) return { error: [401, '회원가입 후 로그인해 주세요.'] };
    return { member: true };
  } catch (e) {
    return { error: [503, '회원 인증을 잠시 후 다시 시도해 주세요.'] };
  }
}

async function signedUrl(file) {
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(`${base}/storage/v1/object/sign/${BUCKET}/${encodeURIComponent(file.key)}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 600 }),
    signal: AbortSignal.timeout(10000)
  });
  if (!r.ok) throw new Error('sign failed ' + r.status);
  const { signedURL } = await r.json();
  return `${base}/storage/v1${signedURL}&download=${encodeURIComponent(file.name)}`;
}

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Authorization');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const item = req.query.item || '';
  if (!['photo-posts', 'prompts', 'downloads', 'download'].includes(item)) return res.status(404).json({ error: '자료를 찾을 수 없습니다.' });

  const who = await getMember(req.headers.authorization || '');
  if (who.error) return res.status(who.error[0]).json({ error: who.error[1] });

  if (item === 'photo-posts') return res.status(200).json(photoView(who.member));
  if (item === 'prompts') return res.status(200).json(promptView(who.member));
  if (item === 'downloads') return res.status(200).json(downloadList(who.member));

  if (!who.member) return res.status(401).json({ error: '회원 로그인 후 내려받을 수 있습니다.' });
  const file = DOWNLOADS.find(f => f.key === req.query.file);
  if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  try {
    return res.status(200).json({ url: await signedUrl(file) });
  } catch (e) {
    console.error('member download', e);
    return res.status(503).json({ error: '내려받기 주소를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
};
"""
dump = lambda o: json.dumps(o, ensure_ascii=False)
js = js.replace("__PHOTO__", dump(photo)).replace("__PROMPTS__", dump(prompts)).replace("__DOWNLOADS__", dump(downloads))
(HERE.parent / "api" / "members.js").write_text(js, encoding="utf-8")
print("photo", len(posts), "prompts", sum(len(g["items"]) for g in prompts["groups"]), [len(g["items"]) for g in prompts["groups"]], "downloads", len(downloads))
