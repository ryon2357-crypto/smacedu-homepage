"""회원 전용 자료실 API(api/members.js)를 만든다.
스마트폰 사진 글 목록은 문서함 대시보드 파일에서 읽어 사진 관련 6개 분류만 넣는다.
다시 만들 때: python scripts/build_members_api.py <대시보드 html 경로>"""
import json, re, sys, pathlib

KEEP = ["촬영 팁", "계절·장소별 촬영 팁", "보정·앱", "영상 촬영·편집", "촬영 사례·출사기"]
src = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
rows = json.loads(re.search(r"const DATA=(\[.*?\]);\n", src, re.S).group(1))
posts = [{"id": r["id"], "title": " ".join(r["title"].split()), "date": r["date"], "type": r["type"], "sum": (r.get("sum") or "").strip()}
         for r in rows if r["type"] in KEEP]
posts.sort(key=lambda p: p["date"], reverse=True)
data = {"types": KEEP, "posts": posts}

js = r"""// 회원 전용 자료실 API — scripts/build_members_api.py가 만든다(직접 고치지 말 것)
// GET /api/members?item=photo-posts
//   비로그인: 분류별 개수와 분류마다 2편 미리보기
//   로그인 회원(Supabase 토큰 확인): 전체 목록
const PHOTO = %s;

function preview() {
  const counts = {}, sample = [];
  for (const t of PHOTO.types) {
    const list = PHOTO.posts.filter(p => p.type === t);
    counts[t] = list.length;
    sample.push(...list.slice(0, 2));
  }
  return { member: false, total: PHOTO.posts.length, types: PHOTO.types, counts, posts: sample };
}

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Authorization');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if ((req.query.item || '') !== 'photo-posts') return res.status(404).json({ error: '자료를 찾을 수 없습니다.' });

  const auth = req.headers.authorization || '';
  if (!auth) return res.status(200).json(preview());
  if (!/^Bearer \S+$/.test(auth)) return res.status(401).json({ error: '로그인이 필요합니다.' });
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!base || !key) return res.status(503).json({ error: '회원 인증 서비스를 확인해 주세요.' });
  try {
    const r = await fetch(base + '/auth/v1/user', { headers: { apikey: key, Authorization: auth }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return res.status(401).json({ error: '다시 로그인해 주세요.' });
    const user = await r.json();
    if (!user.id || user.is_anonymous) return res.status(401).json({ error: '회원가입 후 로그인해 주세요.' });
    const counts = {};
    for (const t of PHOTO.types) counts[t] = PHOTO.posts.filter(p => p.type === t).length;
    return res.status(200).json({ member: true, total: PHOTO.posts.length, types: PHOTO.types, counts, posts: PHOTO.posts });
  } catch (e) {
    return res.status(503).json({ error: '회원 인증을 잠시 후 다시 시도해 주세요.' });
  }
};
""" % json.dumps(data, ensure_ascii=False)
pathlib.Path(__file__).resolve().parent.parent.joinpath("api", "members.js").write_text(js, encoding="utf-8")
print(len(posts), {t: sum(p["type"] == t for p in posts) for t in KEEP})
