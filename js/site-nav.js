// 공용 상단 네비게이션 — index.html / replay.html / reviews.html / certificates.html 공용
// 사용법: <div id="site-nav-root" data-page="index|replay|reviews|certificates"></div>
// supabase-js CDN + js/config.js 로드 이후, </body> 직전에서 <script src="js/site-nav.js"></script> 로 호출

;(function () {
    const root = document.getElementById('site-nav-root')
    if (!root) return

    const page   = root.dataset.page || 'index'
    const prefix = page === 'index' ? '' : 'index.html'

    const NAV_ITEMS = [
        { label: 'HOME',           anchor: 'home' },
        { label: '대표소개',        anchor: 'about' },
        { label: '강사진',          href: 'instructors.html', key: 'instructors' },
        { label: '교육과정',        anchor: 'courses' },
        // twoLine: 좁은 데스크톱(1041~1640px)에서 두 줄로 접어 가로폭을 줄인다
        { label: '스마트폰 사진강의', href: 'smartphone-photo-lecture.html', twoLine: true },
        { label: '자격증',          href: 'certificates.html', key: 'certificates' },
        { label: '수강후기',        href: 'reviews.html', key: 'reviews' },
        { label: '강의 다시보기',    href: 'replay.html',  key: 'replay' },
    ]

    const KAKAO_ICON = (size) =>
        `<svg width="${size}" height="${size}" viewBox="0 0 36 36" style="flex-shrink:0">` +
        `<rect width="36" height="36" rx="9" fill="#FEE500"/>` +
        `<path fill="#191919" d="M18 8c-7.18 0-13 4.58-13 10.24 0 3.62 2.42 6.8 6.06 8.62-.27.98-.97 3.58-1.11 4.13-.17.68.25.67.53.49.22-.14 3.5-2.38 4.92-3.35.85.12 1.72.19 2.6.19 7.18 0 13-4.58 13-10.24S25.18 8 18 8z"/>` +
        `</svg>`

    function itemHref(item) {
        return item.href ? item.href : `${prefix}#${item.anchor}`
    }

    const desktopItems = NAV_ITEMS.map((item) => {
        const cls = []
        if (item.key === page) cls.push('active')
        if (item.twoLine)      cls.push('nav-2line')
        const attr = cls.length ? ` class="${cls.join(' ')}"` : ''
        return `<li${attr}><a href="${itemHref(item)}">${item.label}</a></li>`
    }).join('')

    const mobileItems = NAV_ITEMS.map((item) =>
        `<li><a href="${itemHref(item)}">${item.label}</a></li>`
    ).join('')

    const communityDesktop = `
        <li class="nav-dropdown">
            <button type="button" class="nav-dropdown-toggle">커뮤니티 <span class="caret">▾</span></button>
            <ul class="nav-dropdown-menu">
                <li><a href="https://invite.kakao.com/tc/sEmjtp7axZ" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:6px;">${KAKAO_ICON(14)}팀채팅</a></li>
                <li><a href="https://cafe.naver.com/elsnap7" target="_blank" rel="noopener">사진카페 포토피플</a></li>
                <li><a href="https://cafe.naver.com/elanvital" target="_blank" rel="noopener">스마트미디어아트센터 카페</a></li>
            </ul>
        </li>`

    const communityMobile = `
        <li><a href="https://invite.kakao.com/tc/sEmjtp7axZ" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;">${KAKAO_ICON(16)}팀채팅</a></li>
        <li><a href="https://cafe.naver.com/elsnap7" target="_blank" rel="noopener">사진카페 포토피플</a></li>
        <li><a href="https://cafe.naver.com/elanvital" target="_blank" rel="noopener">스마트미디어아트센터 카페</a></li>`

    const resourcesDesktop = `
        <li class="nav-dropdown">
            <button type="button" class="nav-dropdown-toggle">자료실 <span class="caret">▾</span></button>
            <ul class="nav-dropdown-menu">
                <li><a href="lecturer-jobs.html">강사모집 공고</a></li>
                <li><a href="smartphone-video-editing.html">스마트폰 영상 촬영·편집</a></li>
            </ul>
        </li>`

    const resourcesMobile = `
        <li><a href="lecturer-jobs.html">강사모집 공고</a></li>
        <li><a href="smartphone-video-editing.html">스마트폰 영상 촬영·편집</a></li>`

    // ── 좁은 데스크톱 대응 (2026-08-17) ─────────────────────────────
    // 1041~1500px에서는 내비 항목이 넘쳐 오른쪽 "출강·수강 문의"·로그인이 잘렸다.
    // 페이지별 <style> 뒤에 붙어야 이기므로 head 끝에 주입한다.
    // 햄버거로 바뀌는 1040px 이하와 겹치지 않도록 min-width:1041px로 묶는다.
    const compactCss = document.createElement('style')
    compactCss.id = 'site-nav-compact'
    compactCss.textContent = `
@media (min-width:1041px) and (max-width:1640px) {
    nav { padding: 0 32px; }
    .nav-links { gap: 16px; }
    .logo-img { height: 60px; }
    .nav-brand-name { font-size: 21px; }
    .nav-links li.nav-2line a {
        display: inline-block; white-space: normal; word-break: keep-all;
        width: min-content; text-align: center; line-height: 1.3;
    }
}
@media (min-width:1041px) and (max-width:1400px) {
    nav { padding: 0 20px; }
    .nav-links { gap: 11px; }
    .nav-links a, .nav-dropdown-toggle { font-size: 12.5px; }
    .nav-links .cta a { padding: 8px 14px; }
    .btn-nav-login, .btn-nav-mypage { padding: 7px 11px; font-size: 12.5px; }
    .nav-user-area { gap: 6px; }
    .logo-img { height: 52px; }
    .nav-brand-name { font-size: 18px; }
    .nav-brand-sub { font-size: 11.5px; }
}
/* 로그인 상태에서는 "마이페이지+로그아웃"이 로그인 버튼보다 넓어 한 번 더 줄인다 */
@media (min-width:1041px) and (max-width:1160px) {
    .nav-links { gap: 7px; }
    .nav-links a, .nav-dropdown-toggle { font-size: 12px; }
    .nav-links .cta a { padding: 8px 10px; }
    .btn-nav-login, .btn-nav-mypage { padding: 6px 9px; font-size: 12px; }
    .logo-img { height: 42px; }
    .nav-brand-name { font-size: 15px; }
    .nav-brand-sub { display: none; }
}`
    document.head.appendChild(compactCss)

    root.outerHTML = `
<nav id="nav">
    <a href="${page === 'index' ? '#home' : 'index.html#home'}" class="nav-logo">
        <img src="images/logo1.png" alt="스마트미디어아트센터" class="logo-img">
        <div class="nav-brand-block">
            <span class="nav-brand-name">스마트미디어아트센터</span>
            <span class="nav-brand-sub">배움의 문턱을 낮추다</span>
        </div>
    </a>
    <ul class="nav-links">
        ${desktopItems}
        ${resourcesDesktop}
        ${communityDesktop}
        <li class="cta"><a href="${prefix}#lecture-request">출강·수강 문의</a></li>
        <li id="navAuthArea"></li>
    </ul>
    <div class="hamburger" id="hbg"><span></span><span></span><span></span></div>
</nav>

<div class="mob-menu" id="mob">
    <ul>
        ${mobileItems}
        ${resourcesMobile}
        ${communityMobile}
        <li><a href="${prefix}#lecture-request">출강·수강 문의</a></li>
        <li id="navAuthAreaMob"></li>
    </ul>
</div>`

    // outerHTML 교체로 새로 생긴 엘리먼트를 다시 조회
    const navEl = document.getElementById('nav')
    const hbg   = document.getElementById('hbg')
    const mob   = document.getElementById('mob')

    window.addEventListener('scroll', () => {
        navEl.classList.toggle('scrolled', window.scrollY > 40)
    })

    hbg.addEventListener('click', () => {
        mob.classList.toggle('open')
        const s = hbg.querySelectorAll('span')
        if (mob.classList.contains('open')) {
            s[0].style.cssText = 'transform:translateY(7px) rotate(45deg)'
            s[1].style.cssText = 'opacity:0'
            s[2].style.cssText = 'transform:translateY(-7px) rotate(-45deg)'
        } else {
            s.forEach((x) => x.style.cssText = '')
        }
    })

    function closeMob() {
        mob.classList.remove('open')
        hbg.querySelectorAll('span').forEach((x) => x.style.cssText = '')
    }
    mob.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMob))

    // 로그인 상태 표시
    if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') return
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    client.auth.getSession().then((res) => {
        const session = res.data && res.data.session
        const area    = document.getElementById('navAuthArea')
        const areaMob = document.getElementById('navAuthAreaMob')

        if (session) {
            area.innerHTML = `<div class="nav-user-area"><a href="mypage.html" class="btn-nav-mypage">마이페이지</a><button class="btn-nav-logout" id="siteNavLogout">로그아웃</button></div>`
            document.getElementById('siteNavLogout').addEventListener('click', () => {
                client.auth.signOut().then(() => location.reload())
            })
            areaMob.innerHTML = `<a href="mypage.html">마이페이지</a><a href="#" id="siteNavLogoutMob">로그아웃</a>`
            document.getElementById('siteNavLogoutMob').addEventListener('click', (e) => {
                e.preventDefault()
                client.auth.signOut().then(() => location.reload())
            })
        } else {
            area.innerHTML    = `<a href="login.html?redirect=replay.html" class="btn-nav-login">로그인</a>`
            areaMob.innerHTML = `<a href="login.html?redirect=replay.html">로그인</a>`
        }
        areaMob.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMob))
    })
})()
