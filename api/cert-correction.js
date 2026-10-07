const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz47FQesvuy7rBzB_VYye85Vj6cjDpstFYTVvdNnDdjsNyb_HgD4DQM-vi6udtSZApa/exec'

function clean(value, maxLength = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body || {}
  const payload = {
    form: 'certcorrection',
    name: clean(body.name, 100),
    cert: clean(body.cert, 100),
    certNo: clean(body.certNo, 100),
    email: clean(body.email, 320),
    birth: clean(body.birth, 100),
    note: clean(body.note, 1000),
  }

  if (!payload.name || !payload.cert || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return res.status(400).json({ error: '필수 입력값을 확인해 주세요.' })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)
  try {
    const params = new URLSearchParams(payload)
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?${params}`, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`Google Apps Script ${response.status}`)

    const result = await response.json().catch(() => null)
    if (!result || result.status !== 'success') {
      throw new Error(result && result.message ? result.message : '응답 저장 실패')
    }
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('자격증 정정 신청 저장 오류:', error)
    return res.status(502).json({ error: '접수 시스템 연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.' })
  } finally {
    clearTimeout(timer)
  }
}
