let busy = false;
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  const origin = new URL(sender.url || 'https://invalid.local');
  if (origin.origin !== 'https://www.smacedu.kr' || !/^\/youtube-script(?:\.html)?$/.test(origin.pathname) || message.type !== 'extract' || !/^[A-Za-z0-9_-]{11}$/.test(message.videoId || '')) return;
  if (busy) { reply({error:'앞선 스크립트를 가져오는 중입니다.'}); return; }
  busy = true;
  (async () => {
    let tab;
    try {
      tab = await chrome.tabs.create({url:'https://www.youtube.com/watch?v=' + message.videoId, active:false});
      for (let i=0; i<40; i++) {
        const current = await chrome.tabs.get(tab.id);
        if (current.status === 'complete') break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      const results = await chrome.scripting.executeScript({target:{tabId:tab.id}, func:readVisibleTranscript});
      const result = results[0]?.result;
      if (!result?.segments?.length) throw new Error(result?.error || '유튜브에서 스크립트 표시를 열 수 없습니다. 해당 영상의 공개 스크립트를 확인해 주세요.');
      reply({payload:{...result, videoId:message.videoId, thumbnail:'https://i.ytimg.com/vi/'+message.videoId+'/hqdefault.jpg', trackLabel:'유튜브 스크립트'}});
    } catch (error) { reply({error:error.message}); }
    finally { busy=false; if(tab?.id) await chrome.tabs.remove(tab.id).catch(()=>{}); }
  })();
  return true;
});

async function readVisibleTranscript() {
  const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
  // Only the transcript exposed by YouTube's normal page controls is read.
  document.querySelector('video')?.pause();
  for (let attempt=0; attempt<35; attempt++) {
    const rows = [...document.querySelectorAll('ytd-transcript-segment-renderer, transcript-segment-view-model')];
    if (rows.length) {
      const segments = rows.map(row => {
        const stamp = row.querySelector('.segment-timestamp, .ytwTranscriptSegmentViewModelTimestamp')?.textContent.trim() || '';
        const text = row.querySelector('.segment-text, .ytAttributedStringHost')?.textContent.trim() || '';
        return {start:stamp.split(':').reduce((sum,part)=>sum*60+Number(part),0),duration:0,text};
      }).filter(row=>row.text && Number.isFinite(row.start));
      segments.forEach((row,index)=>row.duration=Math.max(0,(segments[index+1]?.start || row.start)-row.start));
      return {title:document.querySelector('h1.ytd-watch-metadata')?.textContent.trim() || document.title.replace(/ - YouTube$/,''),channel:document.querySelector('#owner #channel-name')?.textContent.trim() || '',segments};
    }
    const buttons = [...document.querySelectorAll('button')];
    const show = buttons.find(button=>/^(스크립트 표시|Show transcript)$/i.test((button.textContent || button.getAttribute('aria-label') || '').trim()));
    if(attempt===1) document.querySelector('ytd-watch-metadata #expand')?.click();
    if(show) show.click();
    await delay(700);
  }
  return {error:'이 영상에서 공개 스크립트를 찾지 못했습니다. YouTube에서 스크립트 표시가 가능한지 확인해 주세요.'};
}
