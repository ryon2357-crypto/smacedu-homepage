window.addEventListener('message', async event => {
  if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'smac-transcript-page') return;
  const { type, requestId, videoId } = event.data;
  if (type === 'ping') {
    window.postMessage({source:'smac-transcript-extension', type:'ready'}, location.origin);
    return;
  }
  if (type !== 'extract' || !/^[A-Za-z0-9_-]{11}$/.test(videoId || '') || typeof requestId !== 'string') return;
  try {
    const result = await chrome.runtime.sendMessage({type:'extract', videoId});
    window.postMessage({source:'smac-transcript-extension', requestId, ...result}, location.origin);
  } catch {
    window.postMessage({source:'smac-transcript-extension', requestId, error:'연결 도구를 다시 불러오려면 페이지를 새로고침해 주세요.'}, location.origin);
  }
});
