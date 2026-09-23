const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const ADMIN_EMAIL          = process.env.ADMIN_EMAIL || 'ryon2357@gmail.com'

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증이 필요합니다.' })
  }
  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 토큰으로 요청자 확인
  const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !caller) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' })
  }
  if (caller.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: '관리자 권한이 없습니다.' })
  }

  // ── 상태·메모 수정 ──────────────────────────────────
  if (req.method === 'PATCH') {
    const { id, status, memo } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id가 필요합니다.' })

    const patch = {}
    if (status !== undefined) patch.status = status
    if (memo !== undefined)   patch.memo = memo
    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: '수정할 값이 없습니다.' })
    }

    const { error: updateError } = await supabase
      .from('instructor_applications')
      .update(patch)
      .eq('id', id)

    if (updateError) {
      console.error('강사 등록 수정 오류:', updateError)
      return res.status(500).json({ error: '수정 중 오류가 발생했습니다.' })
    }
    return res.status(200).json({ ok: true })
  }

  // ── 전체 목록 조회 (+ 이력서 파일 signed URL 발급) ──────
  const { data: rows, error: listError } = await supabase
    .from('instructor_applications')
    .select('*')
    .order('created_at', { ascending: false })

  if (listError) {
    console.error('강사 등록 조회 오류:', listError)
    return res.status(500).json({ error: '목록을 가져오는 중 오류가 발생했습니다.' })
  }

  const applications = await Promise.all((rows || []).map(async (row) => {
    let resume_url = null
    if (row.resume_file_path) {
      const { data: signed } = await supabase.storage
        .from('instructor-resumes')
        .createSignedUrl(row.resume_file_path, 60 * 60) // 1시간 유효
      resume_url = signed ? signed.signedUrl : null
    }
    return { ...row, resume_url }
  }))

  return res.status(200).json({ applications, total: applications.length })
}
