const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzy1Qb1k1k_HMwYrQTHoGPbhWFs0r9J6bC6iGkvL0o7SEaJwQr4d72tZKATbIdTvojWnQ/exec'
const fallback = require('../data/reviews.json')

function publicReview(review) {
  return {
    rating: Number(review && review.rating) || 5,
    name: String((review && review.name) || '익명').slice(0, 100),
    course: String((review && review.course) || '').slice(0, 200),
    age: String((review && review.age) || '').slice(0, 30),
    content: String((review && review.content) || '').slice(0, 5000),
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)

  try {
    const params = new URLSearchParams({ action: 'fetch', status: 'approved' })
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?${params}`, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) throw new Error(`Google Apps Script ${response.status}`)

    const data = await response.json()
    if (!data || data.status !== 'success' || !Array.isArray(data.reviews)) {
      throw new Error('후기 응답 형식이 올바르지 않습니다.')
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400')
    return res.status(200).json({
      status: 'success',
      reviews: data.reviews.map(publicReview),
    })
  } catch (error) {
    console.error('공개 후기 로드 오류:', error)
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=86400')
    return res.status(200).json({
      status: 'success',
      reviews: fallback.reviews,
      stale: true,
    })
  } finally {
    clearTimeout(timer)
  }
}
