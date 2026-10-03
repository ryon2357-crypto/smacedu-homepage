const fs = require('fs/promises')
const path = require('path')

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzy1Qb1k1k_HMwYrQTHoGPbhWFs0r9J6bC6iGkvL0o7SEaJwQr4d72tZKATbIdTvojWnQ/exec'

function publicReview(review) {
  return {
    rating: Number(review && review.rating) || 5,
    name: String((review && review.name) || '익명').slice(0, 100),
    course: String((review && review.course) || '').slice(0, 200),
    age: String((review && review.age) || '').slice(0, 30),
    content: String((review && review.content) || '').slice(0, 5000),
  }
}

async function main() {
  const params = new URLSearchParams({ action: 'fetch', status: 'approved' })
  const response = await fetch(`${GOOGLE_SCRIPT_URL}?${params}`, { redirect: 'follow' })
  if (!response.ok) throw new Error(`Google Apps Script ${response.status}`)

  const data = await response.json()
  if (!data || data.status !== 'success' || !Array.isArray(data.reviews)) {
    throw new Error('후기 응답 형식이 올바르지 않습니다.')
  }

  const output = path.join(__dirname, '..', 'data', 'reviews.json')
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, `${JSON.stringify({ status: 'success', reviews: data.reviews.map(publicReview) })}\n`)
  console.log(`공개 후기 ${data.reviews.length}건 저장: ${output}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
