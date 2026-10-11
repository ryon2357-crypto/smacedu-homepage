// 챗GPT 친구초대 품앗이 — "아직 못 받음" 회원을 "준비된 Plus" 회원에게 몰아서 매칭하는 API
// 데이터: 구글 시트(INVITE_SHEET_ID)의 '앱_회원' / '앱_매칭' 탭
// 규칙(대표님 지시 2026-10-11):
//  - 무료 회원이 "아직 초대를 못 받았어요"를 남기면 기존 매칭(구글폼 시절 포함)은 안 된 것으로 보고 취소 → 그 Plus에게 취소 메일
//  - 그 Plus는 빼고, "초대해 드릴 수 있어요"를 남긴 준비된 Plus에게만 배정(각자 적은 인원까지, 최대 3명) — 재매칭은 최대 3회
//  - 무료 회원 1명당 진행 중인 초대자는 1명, 먼저 남긴 순서대로
const SHEET_ID = process.env.INVITE_SHEET_ID
const ADMIN_KEY = process.env.INVITE_ADMIN_KEY
const MAX_CAP = 3
const MAX_TRIES = 3
const BLOG = 'https://blog.naver.com/elanvital7/224436284985'
const CAFE = 'https://cafe.naver.com/elanvital/920'
const CONTACT = '엘란비탈 박성욱 작가 개인톡(☎ 010-4717-0624)'
const OPEN = ['matched', 'invited']            // 진행 중(앱 매칭)
const LIVE = ['legacy', 'matched', 'invited']  // 취소 대상이 되는 진행 중 매칭(구글폼 시절 legacy 포함)

const clean = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const normEmail = (v) => clean(String(v || ''), 200).replace(/^[\s,;]+|[\s,;]+$/g, '').replace('gmail,com', 'gmail.com').replace(/@gmail\.co\.?$/i, '@gmail.com').toLowerCase()
const normName = (v) => clean(String(v || ''), 50).replace(/\s+/g, '')
const isEmail = (e) => /^[^\s@,]+@[^\s@,]+\.[a-z]{2,}$/i.test(e)
const now = () => new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })

async function accessToken(refresh) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.G_CLIENT_ID, client_secret: process.env.G_CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('구글 인증 실패')
  return j.access_token
}
async function sheets(tok, path, opt = {}) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`, { ...opt, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' } })
  if (!r.ok) throw new Error('시트 오류 ' + r.status + ' ' + (await r.text()).slice(0, 200))
  return r.json()
}
async function load(tok) {
  const j = await sheets(tok, `/values:batchGet?ranges=${encodeURIComponent("'앱_회원'!A2:H")}&ranges=${encodeURIComponent("'앱_매칭'!A2:K")}`)
  const [m, p] = j.valueRanges.map((x) => x.values || [])
  const members = m.map((r, i) => ({ row: i + 2, at: r[0] || '', name: r[1] || '', email: (r[2] || '').toLowerCase(), plan: r[3] || '', status: r[4] || 'active', memo: r[5] || '', source: r[6] || '', cap: Number(r[7] || 0) }))
  const pairs = p.map((r, i) => ({ row: i + 2, id: r[0], at: r[1], plusName: r[2] || '', plusEmail: (r[3] || '').toLowerCase(), freeName: r[4] || '', freeEmail: (r[5] || '').toLowerCase(), status: r[6], tries: Number(r[7] || 0), updated: r[8] || '', reason: r[9] || '', memo: r[10] || '' }))
  return { members, pairs }
}
const pairRow = (x) => [x.id, x.at, x.plusName, x.plusEmail, x.freeName, x.freeEmail, x.status, x.tries, x.updated, x.reason, x.memo]
const memberRow = (m) => [m.at, m.name, m.email, m.plan, m.status, m.memo, m.source, m.cap]
async function append(tok, tab, rows) {
  await sheets(tok, `/values/${encodeURIComponent(`'${tab}'!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: rows }) })
}
async function put(tok, tab, row, cols, values) {
  await sheets(tok, `/values/${encodeURIComponent(`'${tab}'!A${row}:${cols}${row}`)}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [values] }) })
}
const nextRow = (arr) => (arr.length ? Math.max(...arr.map((x) => x.row)) + 1 : 2)

// ── 메일 ─────────────────────────────────────────────
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')
function bodies(name, paras, link, label) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
  const html = `<div style="font-family:Malgun Gothic,sans-serif;font-size:15px;line-height:1.7;color:#222;max-width:560px"><p>${esc(name)} 님, 안녕하세요. 엘란비탈 박성욱 작가입니다.</p>${paras.map((p) => `<p>${esc(p)}</p>`).join('')}${link ? `<p style="margin:20px 0"><a href="${link}" style="background:#d97757;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">${label}</a></p>` : ''}<p>잘 모르시겠으면 화면을 스크린샷 찍어서 <b>${CONTACT}</b>으로 보내 주세요.</p><p>내 상태 확인: <a href="https://www.smacedu.kr/chatgpt-invite">smacedu.kr/chatgpt-invite</a></p><p>감사합니다.<br>엘란비탈 박성욱 드림</p></div>`
  const text = `${name} 님, 안녕하세요. 엘란비탈 박성욱 작가입니다.\n\n${paras.join('\n\n')}${link ? `\n\n▶ ${label}\n${link}` : ''}\n\n잘 모르시겠으면 화면을 스크린샷 찍어서 ${CONTACT}으로 보내 주세요.\n\n내 상태 확인: https://www.smacedu.kr/chatgpt-invite\n\n감사합니다.\n엘란비탈 박성욱 드림\n`
  return { html, text }
}
async function sendMail(gtok, to, subject, name, paras, link = '', label = '') {
  const { html, text } = bodies(name, paras, link, label)
  const bd = 'b' + Date.now()
  const raw = [`To: ${to}`, `Subject: =?UTF-8?B?${b64(subject)}?=`, 'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${bd}"`, '',
    `--${bd}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(text),
    `--${bd}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(html), `--${bd}--`].join('\r\n')
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', headers: { Authorization: `Bearer ${gtok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: Buffer.from(raw).toString('base64url') }),
  })
  return r.ok
}
const mailPlus = (g, p, f) => sendMail(g, p.email, '[코덱스 품앗이] 아래 이메일 주소로 ChatGPT 초대를 부탁드립니다', p.name,
  ['초대해 드릴 수 있다고 남겨 주셔서 감사합니다.', `초대해 주실 분의 ChatGPT 가입 이메일은 아래 한 곳입니다.\n\n  ▶ ${f.email}`, '아래 안내 글대로 위 주소로 초대해 주세요. 초대하신 뒤 상태 확인 페이지에서 [초대 보냈어요]를 눌러 주시면 더 좋습니다.'],
  BLOG, '초대 방법 보러 가기')
const mailFree = (g, f) => sendMail(g, f.email, '[코덱스 품앗이] 새로 초대해 주실 분을 연결해 드렸습니다', f.name,
  ["곧 ChatGPT에서 'ChatGPT 데스크톱 앱에 초대되었습니다'라는 제목의 메일이 도착합니다. 스팸함도 함께 확인해 주세요.", '메일이 오면 아래 안내 글대로 진행해 주시면 됩니다.'],
  CAFE, '진행 방법 보러 가기')
const mailCancel = (g, name, email, freeEmail) => sendMail(g, email, '[코덱스 품앗이] 초대 매칭이 취소되었습니다', name,
  [`앞서 안내드린 초대 대상(${freeEmail}) 매칭이 취소되었습니다. 이 주소로는 초대하지 않으셔도 됩니다.`, '참여해 주셔서 감사합니다.'])

// ── 매칭 ─────────────────────────────────────────────
const openCount = (st, email) => st.pairs.filter((x) => x.plusEmail === email && OPEN.includes(x.status)).length
const doneCount = (st, email) => st.pairs.filter((x) => x.plusEmail === email && ['matched', 'invited', 'accepted'].includes(x.status)).length
function pickPlus(st, free) {
  const tried = st.pairs.filter((x) => x.freeEmail === free.email).map((x) => x.plusEmail)
  const c = st.members
    .filter((m) => m.plan === 'plus' && m.status === 'ready' && m.email !== free.email && normName(m.name) !== normName(free.name) && !tried.includes(m.email))
    .filter((m) => doneCount(st, m.email) < Math.min(m.cap || 1, MAX_CAP))
    .sort((a, b) => doneCount(st, a.email) - doneCount(st, b.email) || a.row - b.row)
  return c[0] || null
}
async function matchFree(tok, g, st, free) {
  const mine = st.pairs.filter((x) => x.freeEmail === free.email && x.status !== 'legacy' && x.memo !== 'legacy')
  if (st.pairs.some((x) => x.freeEmail === free.email && ['matched', 'invited', 'accepted'].includes(x.status))) return 'already'
  if (mine.length >= MAX_TRIES) return 'max'
  const p = pickPlus(st, free)
  if (!p) return 'wait'
  const pair = { row: nextRow(st.pairs), id: 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: now(), plusName: p.name, plusEmail: p.email, freeName: free.name, freeEmail: free.email, status: 'matched', tries: mine.length + 1, updated: now(), reason: '', memo: '앱 매칭' }
  await append(tok, '앱_매칭', [pairRow(pair)])
  st.pairs.push(pair)
  await mailPlus(g, p, free)
  await mailFree(g, free)
  return 'matched'
}
async function matchWaiting(tok, g, st) {
  const waiting = st.members.filter((m) => m.plan === 'free' && m.status === 'waiting').sort((a, b) => a.row - b.row)
  let n = 0
  for (const f of waiting) {
    const r = await matchFree(tok, g, st, f)
    if (r === 'matched') { f.status = 'active'; await put(tok, '앱_회원', f.row, 'H', memberRow(f)); n++ }
    if (r === 'wait') break
  }
  return n
}
function view(st, me) {
  if (me.plan === 'plus') {
    const list = st.pairs.filter((x) => x.plusEmail === me.email && ['matched', 'invited', 'accepted'].includes(x.status))
    return { role: 'plus', name: me.name, cap: me.cap, invites: list.map((x) => ({ id: x.id, email: x.freeEmail, status: x.status, at: x.at })) }
  }
  const cur = st.pairs.filter((x) => x.freeEmail === me.email && ['matched', 'invited', 'accepted'].includes(x.status)).pop()
  const waitingAhead = me.status === 'waiting' ? st.members.filter((m) => m.plan === 'free' && m.status === 'waiting' && m.row < me.row).length : 0
  return { role: 'free', name: me.name, status: me.status, waitingAhead, tries: st.pairs.filter((x) => x.freeEmail === me.email && x.memo !== 'legacy').length, current: cur ? { id: cur.id, status: cur.status, at: cur.at, plus: cur.plusName.slice(0, 1) + '○○' } : null }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!SHEET_ID) return res.status(500).json({ error: '설정이 완료되지 않았습니다.' })
  const b = req.method === 'POST' ? (req.body || {}) : (req.query || {})
  const action = clean(b.action, 30)
  try {
    const tok = await accessToken(process.env.G_SHEETS_REFRESH)
    const st = await load(tok)
    if (action === 'admin') {
      if (!ADMIN_KEY || b.key !== ADMIN_KEY) return res.status(403).json({ error: '권한 없음' })
      return res.json({ members: st.members, pairs: st.pairs })
    }
    if (action === 'stats') {
      const ready = st.members.filter((m) => m.plan === 'plus' && m.status === 'ready' && doneCount(st, m.email) < Math.min(m.cap || 1, MAX_CAP))
      const slots = ready.reduce((s, m) => s + Math.min(m.cap || 1, MAX_CAP) - doneCount(st, m.email), 0)
      return res.json({ readyPlus: ready.length, slots, waiting: st.members.filter((m) => m.plan === 'free' && m.status === 'waiting').length, matched: st.pairs.filter((x) => x.memo === '앱 매칭').length })
    }
    const email = normEmail(b.email)
    const name = clean(b.name, 50)
    if (!name) return res.status(400).json({ error: '성함을 입력해 주세요.' })
    if (!isEmail(email)) return res.status(400).json({ error: '이메일 주소를 다시 확인해 주세요.' })
    let me = st.members.find((m) => m.email === email)
    const consentOk = b.consent === true || b.consent === 'true'

    if (action === 'not_received' || action === 'ready_plus') {
      const g = await accessToken(process.env.G_GMAIL_REFRESH)
      if (action === 'ready_plus') {
        const cap = Math.max(1, Math.min(MAX_CAP, Number(b.cap) || 1))
        if (me && me.plan === 'free') return res.status(400).json({ error: '무료 회원으로 남겨진 이메일입니다. 다른 이메일을 쓰셨다면 그 이메일로 남겨 주세요.' })
        if (me) { me.status = 'ready'; me.cap = cap; me.name = name; await put(tok, '앱_회원', me.row, 'H', memberRow(me)) }
        else { me = { row: nextRow(st.members), at: now(), name, email, plan: 'plus', status: 'ready', memo: '', source: 'app', cap }; await append(tok, '앱_회원', [memberRow(me)]); st.members.push(me) }
        const n = await matchWaiting(tok, g, st)
        return res.json({ ok: true, message: n ? `기다리던 ${n}분을 바로 연결했습니다. 메일을 확인해 주세요.` : '등록되었습니다. 초대가 필요한 분이 생기면 바로 메일로 알려 드립니다.', view: view(st, me) })
      }
      // not_received
      if (me && me.plan === 'plus') return res.status(400).json({ error: 'Plus 회원으로 남겨진 이메일입니다.' })
      // 기존 매칭 취소(구글폼 시절 포함) + 해당 Plus에게 취소 메일
      for (const x of st.pairs.filter((p) => p.freeEmail === email && LIVE.includes(p.status))) {
        x.status = 'cancelled'; x.reason = '무료 회원 초대 미수신 신고'; x.updated = now()
        await put(tok, '앱_매칭', x.row, 'K', pairRow(x))
        if (x.plusEmail) await mailCancel(g, x.plusName || '회원', x.plusEmail, email)
      }
      if (!me) { me = { row: nextRow(st.members), at: now(), name, email, plan: 'free', status: 'waiting', memo: '', source: 'app', cap: 0 }; await append(tok, '앱_회원', [memberRow(me)]); st.members.push(me) }
      else if (me.status !== 'waiting') { me.status = 'waiting'; await put(tok, '앱_회원', me.row, 'H', memberRow(me)) }
      const r = await matchFree(tok, g, st, me)
      if (r === 'matched') { me.status = 'active'; await put(tok, '앱_회원', me.row, 'H', memberRow(me)) }
      const msg = { matched: '새로 초대해 주실 분을 연결했습니다. 메일(스팸함 포함)을 확인해 주세요.', wait: '지금 바로 초대해 드릴 Plus 회원이 없어 대기 순서에 올렸습니다. 연결되면 메일로 알려 드립니다.', max: `재연결은 ${MAX_TRIES}회까지라 운영자가 직접 확인해 드리겠습니다.`, already: '이미 진행 중인 연결이 있습니다.' }[r]
      return res.json({ ok: true, message: msg, view: view(st, me) })
    }

    if (!me || normName(me.name) !== normName(name)) return res.status(404).json({ error: '남겨 주신 내역을 찾을 수 없습니다. 같은 성함과 이메일로 입력해 주세요.' })
    if (action === 'lookup') return res.json({ view: view(st, me) })
    if (action === 'plus_sent' && me.plan === 'plus') {
      const x = st.pairs.find((p) => p.id === b.id && p.plusEmail === me.email && p.status === 'matched')
      if (x) { x.status = 'invited'; x.updated = now(); await put(tok, '앱_매칭', x.row, 'K', pairRow(x)) }
      return res.json({ view: view(st, me) })
    }
    if (action === 'free_received' && me.plan === 'free') {
      const x = st.pairs.find((p) => p.freeEmail === me.email && OPEN.includes(p.status))
      if (x) { x.status = 'accepted'; x.updated = now(); await put(tok, '앱_매칭', x.row, 'K', pairRow(x)) }
      return res.json({ view: view(st, me) })
    }
    return res.status(400).json({ error: '잘못된 요청입니다.' })
  } catch (e) {
    console.error('chatgpt-invite', e)
    return res.status(500).json({ error: '잠시 후 다시 시도해 주세요.' })
  }
}
