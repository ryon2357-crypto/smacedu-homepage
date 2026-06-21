// 사이트 콘텐츠 드래그·복사 방지
(function () {
  const style = document.createElement('style');
  style.textContent = `
    body { -webkit-user-select: none; -ms-user-select: none; user-select: none; }
    input, textarea { -webkit-user-select: text; -ms-user-select: text; user-select: text; }
    img { -webkit-user-drag: none; user-drag: none; }
  `;
  document.head.appendChild(style);

  document.addEventListener('dragstart', e => e.preventDefault());
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('copy', e => e.preventDefault());
})();
