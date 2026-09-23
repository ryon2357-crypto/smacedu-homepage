const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const SHEET_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxqYBmeYzXx0P-iODP2kFmIRr95I7ri54zk6EB316ySh9qatmK9QGhKDE5f0Q9dmDfgvQ/exec'

function clean(value, maxLength = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function careerToText(career) {
  return (Array.isArray(career) ? career : [])
    .map((item) => `${clean(item && item.org, 200)} (${clean(item && item.period, 100)}): ${clean(item && item.content, 1000)}`)
    .join(' | ')
}

async function syncToSheet(payload, mode) {
  const params = new URLSearchParams({
    type: 'instructor',
    name: payload.name || '',
    phone: payload.phone || '',
    email: payload.email || '',
    specialties: (payload.specialties || []).join(', '),
    region: payload.region || '',
    certifications: payload.certifications || '',
    career: careerToText(payload.career),
    intro: payload.intro || '',
    mode,
    resumeFileName: payload.resume_file_name || '',
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(`${SHEET_SCRIPT_URL}?${params}`, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!response.ok) return false
    const result = await response.json().catch(() => null)
    return Boolean(result && result.status === 'success')
  } catch (error) {
    console.error('강사 등록 시트 동기화 오류:', error)
    return false
  } finally {
    clearTimeout(timer)
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: '서버 저장 설정이 완료되지 않았습니다.' })
  }

  const body = req.body || {}
  const mode = body.mode === 'build' ? 'build' : 'file'
  const specialties = Array.isArray(body.specialties)
    ? body.specialties.map((item) => clean(item, 100)).filter(Boolean).slice(0, 20)
    : []
  const career = Array.isArray(body.career)
    ? body.career.slice(0, 50).map((item) => ({
        org: clean(item && item.org, 200),
        period: clean(item && item.period, 100),
        content: clean(item && item.content, 1000),
      })).filter((item) => item.org || item.period || item.content)
    : []

  const payload = {
    name: clean(body.name, 100),
    phone: clean(body.phone, 30),
    email: clean(body.email, 320) || null,
    specialties,
    specialty_other: clean(body.specialty_other, 200) || null,
    region: clean(body.region, 200) || null,
    certifications: clean(body.certifications, 2000) || null,
    career,
    intro: clean(body.intro, 5000) || null,
    resume_file_path: clean(body.resume_file_path, 500) || null,
    resume_file_name: clean(body.resume_file_name, 500) || null,
  }

  if (!payload.name || !/^\d{3}-\d{4}-\d{4}$/.test(payload.phone) || !payload.specialties.length) {
    return res.status(400).json({ error: '필수 입력값을 확인해 주세요.' })
  }
  if (mode === 'file' && !payload.resume_file_path) {
    return res.status(400).json({ error: '이력서 파일 정보가 없습니다.' })
  }
  if (mode === 'build' && !payload.career.length) {
    return res.status(400).json({ error: '경력사항을 1개 이상 입력해 주세요.' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data, error } = await supabase
    .from('instructor_applications')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    console.error('강사 등록 원본 저장 오류:', error)
    return res.status(500).json({ error: '응답 저장 중 오류가 발생했습니다.' })
  }

  const sheetSynced = await syncToSheet(payload, mode)
  return res.status(200).json({ ok: true, id: data.id, sheetSynced })
}
