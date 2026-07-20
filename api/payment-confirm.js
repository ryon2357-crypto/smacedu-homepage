const { createClient } = require('@supabase/supabase-js')

const TOSS_SECRET_KEY    = process.env.TOSS_SECRET_KEY
const SUPABASE_URL       = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const PRODUCT_ID         = 'nikon-school-replay'

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { paymentKey, orderId, amount } = req.body

  if (!paymentKey || !orderId || !amount) {
    return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' })
  }

  // 구매 기록의 user_id는 클라이언트가 보낸 값이 아니라, 검증된 로그인 세션에서만 가져온다
  // (그렇지 않으면 요청 본문의 userId를 바꿔서 남의 계정에 구매 기록을 심을 수 있음).
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '로그인이 필요합니다.' })
  }
  const token = authHeader.replace('Bearer ', '')

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !caller) {
      return res.status(401).json({ error: '유효하지 않은 로그인 세션입니다.' })
    }
    const userId = caller.id

    // 1. 토스페이먼츠 결제 승인
    const encoded = Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) })
    })

    const tossData = await tossRes.json()
    if (!tossRes.ok) {
      return res.status(400).json({ error: tossData.message || '결제 승인 실패' })
    }

    // 2. Supabase purchases 테이블에 저장
    const { error: dbError } = await supabase.from('purchases').upsert({
      user_id: userId,
      product_id: PRODUCT_ID,
      order_id: orderId,
      payment_key: paymentKey,
      amount: Number(amount),
      status: 'done'
    }, { onConflict: 'order_id' })

    if (dbError) {
      console.error('DB 저장 오류:', dbError)
      return res.status(500).json({ error: 'DB 저장 중 오류가 발생했습니다.' })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('결제 확인 오류:', err)
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' })
  }
}
