const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL       = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const ADMIN_EMAIL        = process.env.ADMIN_EMAIL || 'aistudy38@gmail.com'

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

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

  // 전체 회원 목록 조회
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  })
  if (usersError) {
    console.error('회원 조회 오류:', usersError)
    return res.status(500).json({ error: '회원 목록을 가져오는 중 오류가 발생했습니다.' })
  }

  // 전체 결제 내역 조회
  const { data: purchases, error: purchasesError } = await supabase
    .from('purchases')
    .select('user_id, product_id, amount, status, created_at')
    .eq('status', 'done')
  if (purchasesError) {
    console.error('결제 내역 오류:', purchasesError)
  }

  // 사용자별 결제 맵 생성
  const purchaseMap = {}
  if (purchases) {
    for (const p of purchases) {
      if (!purchaseMap[p.user_id]) purchaseMap[p.user_id] = []
      purchaseMap[p.user_id].push(p)
    }
  }

  const result = users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.user_metadata?.full_name || '',
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    purchases: purchaseMap[u.id] || []
  }))

  return res.status(200).json({ users: result, total: result.length })
}
