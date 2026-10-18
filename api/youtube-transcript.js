const { createClient } = require('@supabase/supabase-js')

const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
const VISION_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'

function extractVideoId(input) {
  if (!input) return null
  const raw = String(input).trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw

  try {
    const url = new URL(raw)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    let candidate = null

    if (host === 'youtu.be') candidate = url.pathname.split('/').filter(Boolean)[0]
    if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
      candidate = url.searchParams.get('v')
      if (!candidate) {
        const parts = url.pathname.split('/').filter(Boolean)
        if (['shorts', 'embed', 'live'].includes(parts[0])) candidate = parts[1]
      }
    }

    return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null
  } catch {
    return null
  }
}

function balancedJson(source, marker) {
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) return null
  const start = source.indexOf('{', markerIndex + marker.length)
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < source.length; i += 1) {
    const char = source[i]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        try { return JSON.parse(source.slice(start, i + 1)) } catch { return null }
      }
    }
  }
  return null
}

function unescapeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|#39);/gi, (_, key) => {
      if (key[0] === '#') {
        const number = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10)
        return Number.isFinite(number) ? String.fromCodePoint(number) : ''
      }
      return named[key.toLowerCase()] || ''
    })
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function trackLabel(track) {
  const labels = { ko: '한국어', en: '영어', ja: '일본어', zh: '중국어' }
  const name = labels[track?.languageCode]
    || track?.name?.simpleText
    || track?.name?.runs?.map(run => run.text).join('')
    || track?.languageCode
    || '자막'
  return track?.kind === 'asr' ? `${name} 자동 생성` : name
}

function chooseTrack(tracks, requested) {
  if (!tracks.length) return null
  if (requested) {
    const exact = tracks.find(track => track.languageCode === requested)
    if (exact) return exact
  }
  return tracks.find(track => track.languageCode === 'ko' && track.kind !== 'asr')
    || tracks.find(track => track.languageCode === 'ko')
    || tracks.find(track => track.kind !== 'asr')
    || tracks[0]
}

function responseCookies(headers) {
  const values = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie') || '']
  return values
    .flatMap(value => value.split(/,(?=\s*[A-Za-z0-9_-]+=[^;]+)/))
    .map(value => value.split(';')[0].trim())
    .filter(Boolean)
}

async function fetchPlayer(videoId) {
  const baseCookie = 'PREF=hl=en&tz=UTC; SOCS=CAI'
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&bpctr=9999999999&has_verified=1`
  const response = await fetch(watchUrl, {
    headers: {
      'accept-language': 'en-us,en;q=0.5',
      'user-agent': WEB_UA,
      cookie: baseCookie
    },
    signal: AbortSignal.timeout(18000)
  })
  if (!response.ok) throw new Error('유튜브 영상 정보를 확인하지 못했습니다.')

  const cookies = [baseCookie, ...responseCookies(response.headers)].join('; ')
  const html = await response.text()
  const initialPlayer = balancedJson(html, 'ytInitialPlayerResponse =')
    || balancedJson(html, 'ytInitialPlayerResponse=')
    || balancedJson(html, '"ytInitialPlayerResponse":')
  const visitorData = html.match(/"VISITOR_DATA":"([^"]+)/)?.[1] || ''
  const signatureTimestamp = Number(html.match(/"STS":(\d+)/)?.[1] || 0)
  const client = {
    clientName: 'VISIONOS', clientVersion: '1.02', deviceMake: 'Apple',
    deviceModel: 'RealityDevice17,1', userAgent: VISION_UA, osName: 'visionOS',
    osVersion: '26.5.23O471', hl: 'en', timeZone: 'UTC', utcOffsetMinutes: 0
  }

  const apiResponse = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept-language': 'en-us,en;q=0.5',
      'user-agent': VISION_UA,
      'x-youtube-client-name': '101',
      'x-youtube-client-version': '1.02',
      'x-goog-visitor-id': visitorData,
      origin: 'https://www.youtube.com',
      cookie: cookies
    },
    body: JSON.stringify({
      context: { client }, videoId,
      playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS', ...(signatureTimestamp ? { signatureTimestamp } : {}) } },
      contentCheckOk: true,
      racyCheckOk: true
    }),
    signal: AbortSignal.timeout(18000)
  })

  const player = apiResponse.ok ? await apiResponse.json() : null
  const selected = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length ? player : initialPlayer
  return { player: selected, cookies }
}

function compactSegments(segments) {
  const groups = []
  let current = null

  for (const segment of segments) {
    if (!segment.text || segment.text === '[음악]' || segment.text === '[Music]') continue
    const previous = groups[groups.length - 1]
    if (previous && previous.text === segment.text && Math.abs(previous.start - segment.start) < 1.5) continue

    const gap = current ? segment.start - (current.start + current.duration) : 0
    const breakBefore = !current || gap > 2.8 || current.text.length >= 105
      || (/[.!?。！？]$/.test(current.text) && current.text.length >= 28)
    if (breakBefore) {
      current = { ...segment }
      groups.push(current)
      continue
    }
    const needsSpace = !/[\s]$/.test(current.text) && !/^[,.:;!?。，、！？]/.test(segment.text)
    current.text += (needsSpace ? ' ' : '') + segment.text
    current.duration = Math.max(current.duration, segment.start + segment.duration - current.start)
  }
  return groups.slice(0, 6000)
}

async function fetchSegments(baseUrl, cookies) {
  const response = await fetch(baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'fmt=json3', {
    headers: {
      'accept-language': 'en-us,en;q=0.5',
      'user-agent': WEB_UA,
      cookie: cookies
    },
    signal: AbortSignal.timeout(18000)
  })
  if (!response.ok) throw new Error('유튜브 자막 데이터를 불러오지 못했습니다.')

  const raw = await response.text()
  if (raw.length > 12000000) throw new Error('자막 분량이 너무 많아 처리할 수 없습니다.')

  let segments = []
  try {
    const data = JSON.parse(raw)
    segments = (data.events || [])
      .filter(event => event.segs?.length)
      .map(event => ({
        start: Number(event.tStartMs || 0) / 1000,
        duration: Number(event.dDurationMs || 0) / 1000,
        text: unescapeEntities(event.segs.map(segment => segment.utf8 || '').join(''))
      }))
  } catch {
    const pattern = /<text\s+start="([^"]+)"(?:\s+dur="([^"]+)")?[^>]*>([\s\S]*?)<\/text>/g
    let match
    while ((match = pattern.exec(raw))) {
      segments.push({ start: Number(match[1]), duration: Number(match[2] || 0), text: unescapeEntities(match[3]) })
    }
  }
  return compactSegments(segments)
}

async function getTranscript(videoId, languageCode) {
  const session = await fetchPlayer(videoId)
  const player = session.player
  if (!player) throw Object.assign(new Error('영상 정보를 읽을 수 없습니다. 잠시 후 다시 시도해 주세요.'), { statusCode: 502 })

  const playability = player.playabilityStatus
  if (playability?.status && playability.status !== 'OK') {
    throw Object.assign(new Error(playability.reason || '공개적으로 볼 수 없는 영상입니다.'), { statusCode: 422 })
  }

  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
  if (!tracks.length) {
    throw Object.assign(new Error('이 영상에는 공개된 스크립트가 없습니다. 유튜브에서 스크립트 표시가 되는 영상인지 확인해 주세요.'), { statusCode: 404 })
  }

  const track = chooseTrack(tracks, languageCode)
  const segments = await fetchSegments(track.baseUrl, session.cookies)
  if (!segments.length) {
    throw Object.assign(new Error('자막은 확인되지만 내용을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'), { statusCode: 502 })
  }

  const details = player.videoDetails || {}
  return {
    videoId,
    title: details.title || '유튜브 영상',
    channel: details.author || '',
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    trackLabel: trackLabel(track),
    languageCode: track.languageCode || '',
    availableTracks: tracks.map(item => ({ languageCode: item.languageCode, label: trackLabel(item) })),
    segments
  }
}

async function verifyMember(req) {
  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) return null

  const token = authHeader.slice(7).trim()
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return null

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  return error ? null : user
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ message: '지원하지 않는 요청입니다.' })

  const member = await verifyMember(req)
  if (!member) return res.status(401).json({ message: '회원 로그인이 필요합니다.' })

  const videoId = extractVideoId(req.query.url || req.query.video)
  if (!videoId) return res.status(400).json({ message: '올바른 유튜브 링크를 입력해 주세요.' })

  try {
    const payload = await getTranscript(videoId, req.query.lang)
    return res.status(200).json(payload)
  } catch (error) {
    console.error('유튜브 스크립트 오류:', error)
    return res.status(error.statusCode || 502).json({ message: error.message || '스크립트를 가져오는 중 문제가 발생했습니다.' })
  }
}

module.exports = handler
module.exports.extractVideoId = extractVideoId
module.exports.getTranscript = getTranscript
