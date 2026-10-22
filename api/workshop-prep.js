// 민주평통 청년기자단 워크숍 준비 체크리스트 — 공용 편집 저장소
// 상태 JSON 한 개를 Supabase Storage(비공개 버킷)에 저장한다. 별도 DB 표 불필요.
const { createClient } = require('@supabase/supabase-js')

const BUCKET = 'shared-docs'
const DIR = 'workshop-prep-1120'
const MAX_ITEMS = 120

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

function clean(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function emptyState() {
  return { rev: 0, items: {}, extra: [], notes: '', notesBy: '', updatedAt: null, log: [] }
}

async function ensureBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: false })
  if (error && !/exist/i.test(error.message || '')) throw error
}

// 저장소가 같은 이름의 덮어쓰기 파일을 캐시로 오래된 값으로 돌려주므로,
// 저장할 때마다 새 이름의 파일을 만들고 읽을 때는 목록의 가장 최신 파일을 쓴다.
async function latestName() {
  const { data, error } = await supabase.storage.from(BUCKET).list(DIR, {
    limit: 1,
    sortBy: { column: 'name', order: 'desc' },
  })
  if (error || !data || !data.length) return null
  return data[0].name
}

async function load() {
  const name = await latestName()
  if (!name) return emptyState()
  const { data, error } = await supabase.storage.from(BUCKET).download(`${DIR}/${name}`)
  if (error || !data) return emptyState()
  try {
    return Object.assign(emptyState(), JSON.parse(await data.text()))
  } catch (e) {
    return emptyState()
  }
}

async function upload(name, body) {
  return supabase.storage.from(BUCKET).upload(`${DIR}/${name}`, body, {
    contentType: 'application/json',
    cacheControl: '0',
    upsert: false,
  })
}

async function save(state) {
  state.rev += 1
  state.updatedAt = new Date().toISOString()
  const body = Buffer.from(JSON.stringify(state), 'utf8')
  const name = `${String(Date.now()).padStart(15, '0')}-${Math.random().toString(36).slice(2, 6)}.json`
  let { error } = await upload(name, body)
  if (error && /bucket/i.test(error.message || '')) {
    await ensureBucket()
    ;({ error } = await upload(name, body))
  }
  if (error) throw error
  // 오래된 저장본 정리(최근 8개만 유지)
  try {
    const { data } = await supabase.storage.from(BUCKET).list(DIR, {
      limit: 100,
      sortBy: { column: 'name', order: 'desc' },
    })
    const old = (data || []).slice(8).map((f) => `${DIR}/${f.name}`)
    if (old.length) await supabase.storage.from(BUCKET).remove(old)
  } catch (e) {
    console.error('저장본 정리 오류:', e)
  }
  return state
}

const MAX_LOG = 400
const COALESCE_MS = 90 * 1000

// 수정 이력 기록. 같은 사람이 같은 항목의 같은 종류를 연달아 고치면 한 줄로 합친다.
function pushLog(state, entry) {
  if (!Array.isArray(state.log)) state.log = []
  const last = state.log[state.log.length - 1]
  if (
    last &&
    last.by === entry.by &&
    last.id === entry.id &&
    last.kind === entry.kind &&
    ['memo', 'notes'].includes(entry.kind) &&
    Date.parse(entry.at) - Date.parse(last.at) < COALESCE_MS
  ) {
    last.to = entry.to
    last.at = entry.at
    return
  }
  state.log.push(entry)
  if (state.log.length > MAX_LOG) state.log = state.log.slice(-MAX_LOG)
}

function applyOp(state, op) {
  const by = clean(op.by, 30)
  const stamp = new Date().toISOString()
  if (op.op === 'set') {
    const id = clean(op.id, 40)
    if (!id) throw new Error('id 누락')
    const cur = state.items[id] || {}
    const before = { done: !!cur.done, memo: cur.memo || '', owner: cur.owner || '' }
    const f = op.fields || {}
    if (typeof f.done === 'boolean') cur.done = f.done
    if (typeof f.memo === 'string') cur.memo = clean(f.memo, 2000)
    if (typeof f.owner === 'string') cur.owner = clean(f.owner, 10)
    cur.by = by
    cur.at = stamp
    state.items[id] = cur
    if (!!cur.done !== before.done) pushLog(state, { at: stamp, by, id, kind: 'done', to: !!cur.done })
    if ((cur.memo || '') !== before.memo)
      pushLog(state, { at: stamp, by, id, kind: 'memo', from: before.memo.slice(0, 300), to: (cur.memo || '').slice(0, 300) })
    if ((cur.owner || '') !== before.owner) pushLog(state, { at: stamp, by, id, kind: 'owner', to: cur.owner || '' })
    // 모두 비어 있으면 항목 기록을 지운다
    if (!cur.done && !cur.memo && !cur.owner) delete state.items[id]
  } else if (op.op === 'notes') {
    const prev = state.notes || ''
    state.notes = clean(op.text, 8000)
    state.notesBy = by
    if (state.notes !== prev)
      pushLog(state, { at: stamp, by, id: 'notes', kind: 'notes', from: prev.slice(0, 300), to: state.notes.slice(0, 300) })
  } else if (op.op === 'addItem') {
    const text = clean(op.text, 200).trim()
    if (!text) throw new Error('내용 누락')
    if (state.extra.length >= MAX_ITEMS) throw new Error('항목이 너무 많습니다')
    const id = 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    state.extra.push({ id, group: clean(op.group, 2) || 'E', text, by, at: stamp })
    pushLog(state, { at: stamp, by, id, kind: 'add', label: text })
  } else if (op.op === 'delItem') {
    const id = clean(op.id, 40)
    const gone = state.extra.find((x) => x.id === id)
    if (gone) pushLog(state, { at: stamp, by, id, kind: 'del', label: gone.text })
    state.extra = state.extra.filter((x) => x.id !== id)
    delete state.items[id]
  } else {
    throw new Error('알 수 없는 요청')
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  try {
    if (req.method === 'GET') {
      return res.status(200).json(await load())
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
      const state = await load()
      applyOp(state, body)
      return res.status(200).json(await save(state))
    }
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('workshop-prep 오류:', error)
    return res.status(500).json({ error: String((error && error.message) || error) })
  }
}
