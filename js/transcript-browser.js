(() => {
  let connected = false, pending = null;
  const panel = document.createElement('section');
  panel.className = 'search-card';
  panel.style.cssText = 'text-align:left;padding:22px;line-height:1.7';
  panel.innerHTML = `<strong>브라우저에서 스크립트 가져오기</strong>
    <p id="connectionStatus">서버 자동 수집이 제한될 때는 브라우저 연결 도구 또는 스크립트 붙여넣기를 이용하세요.</p>
    <details><summary>PC 크롬 연결 도구 설치</summary><p><a href="/downloads/smac-transcript-extension.zip" download>연결 도구 다운로드</a> 후 압축을 풀어 주세요. 크롬 주소창에 <code>chrome://extensions</code>를 입력하고 개발자 모드를 켠 다음, 압축해제된 확장 프로그램을 로드합니다. manifest.json이 있는 폴더를 선택한 뒤 이 페이지를 새로고침하면 됩니다.</p><p>설치 후 위의 링크 입력과 스크립트 가져오기 버튼을 그대로 사용합니다. 요청한 영상의 스크립트만 읽으며, 로그인 쿠키나 비밀번호를 전송하지 않습니다.</p></details>
    <details id="pasteDetails"><summary>유튜브 스크립트 붙여넣기</summary><p>영상의 스크립트 표시를 열고 시간표시와 내용을 복사해 아래에 붙여넣으세요. TXT 또는 SRT 자막 파일도 열 수 있습니다.</p><label for="pastedTranscript">스크립트 원문</label><textarea id="pastedTranscript" maxlength="1500000" style="display:block;width:100%;min-height:180px;padding:12px;font:inherit;border:1px solid #ddd;border-radius:10px" placeholder="0:00\n첫 번째 자막\n0:05\n다음 자막"></textarea><label>자막 파일 <input id="transcriptFile" type="file" accept=".txt,.srt,.vtt,text/plain"></label><p><button id="importTranscript" class="primary" type="button">붙여넣은 스크립트 정리</button></p></details>`;
  document.querySelector('.hero').appendChild(panel);

  function videoId(value) {
    try { const u = new URL(value); const candidate = u.hostname==='youtu.be' ? u.pathname.slice(1).split('/')[0] : /^(www\.|m\.)?youtube\.com$/.test(u.hostname) ? u.searchParams.get('v') || u.pathname.split('/')[2] : ''; return /^[\w-]{11}$/.test(candidate||'') ? candidate : null; } catch { return null; }
  }
  function showPayload(payload) {
    if(!state.session || !payload?.segments?.length || !/^[\w-]{11}$/.test(payload.videoId)) throw new Error('영상 링크와 스크립트를 확인해 주세요.');
    if(payload.segments.length>20000 || payload.segments.some(x=>typeof x.text!=='string'||!Number.isFinite(x.start)||x.start<0)) throw new Error('지원하지 않는 자막 형식입니다.');
    state.data=payload; state.mode='timed'; state.query=''; $('#findInput').value='';
    $('#videoTitle').textContent=payload.title; $('#channelName').textContent=payload.channel||''; $('#trackName').textContent=payload.trackLabel; $('#segmentCount').textContent=payload.segments.length+'개 자막';
    $('#thumbnail').src='https://i.ytimg.com/vi/'+payload.videoId+'/hqdefault.jpg'; $('#videoLink').href='https://www.youtube.com/watch?v='+payload.videoId;
    history.replaceState(null,'','?video='+payload.videoId); updateTabs(); result.hidden=false;
    setStatus('ok','스크립트를 정리했습니다. 검색, 문단 보기, 복사와 텍스트 저장을 사용할 수 있습니다.'); result.scrollIntoView({behavior:'smooth'});
  }
  window.addEventListener('message', event => {
    if(event.source!==window || event.origin!==location.origin || event.data?.source!=='smac-transcript-extension') return;
    if(event.data.type==='ready') { connected=true; document.getElementById('connectionStatus').textContent='브라우저 연결 완료. 위에 영상 링크를 넣으면 유튜브의 스크립트를 직접 가져옵니다.'; return; }
    if(!pending || event.data.requestId!==pending.id) return;
    clearTimeout(pending.timer); pending=null; submitButton.disabled=false; submitButton.textContent='스크립트 가져오기';
    try { if(event.data.error) throw new Error(event.data.error); showPayload(event.data.payload); } catch(error) { setStatus('error',error.message); }
  });
  window.postMessage({source:'smac-transcript-page',type:'ping'},location.origin);
  form.addEventListener('submit',event=>{
    if(!connected) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if(!state.session || pending) return;
    const id=videoId(urlInput.value); if(!id) {setStatus('error','올바른 유튜브 링크를 입력해 주세요.');return;}
    const requestId=crypto.randomUUID();
    pending={id:requestId,timer:setTimeout(()=>{pending=null;submitButton.disabled=false;submitButton.textContent='스크립트 가져오기';setStatus('error','브라우저 연결 시간이 초과됐습니다. 스크립트 붙여넣기로 이어서 사용할 수 있습니다.');},60000)};
    result.hidden=true; submitButton.disabled=true; setStatus('loading','브라우저에서 유튜브 스크립트를 읽고 있습니다.');
    window.postMessage({source:'smac-transcript-page',type:'extract',requestId,videoId:id},location.origin);
  },true);
  document.getElementById('transcriptFile').addEventListener('change',async event=>{
    const file=event.target.files[0]; if(!file) return;
    if(file.size>1500000){setStatus('error','1.5MB 이하 자막 파일을 선택해 주세요.');return;}
    document.getElementById('pastedTranscript').value=await file.text();
  });
  document.getElementById('importTranscript').addEventListener('click',()=>{
    try {
      const id=videoId(urlInput.value); if(!id) throw new Error('위 입력칸에 원본 영상 링크를 넣어 주세요.');
      const text=document.getElementById('pastedTranscript').value.trim();
      if(!text) throw new Error('스크립트를 붙여넣거나 자막 파일을 열어 주세요.');
      const segments=parseTranscript(text);
      showPayload({videoId:id,title:'붙여넣은 영상 스크립트',channel:'',trackLabel:'사용자 제공 자막',segments});
    } catch(error) {setStatus('error',error.message);}
  });
  function parseTranscript(text) {
    const lines=text.replace(/\r/g,'').split('\n'), segments=[]; let current=null;
    const seconds=stamp=>stamp.replace(',','.').split(':').reduce((sum,part)=>sum*60+Number(part),0);
    for(let i=0;i<lines.length;i++) {
      const line=lines[i].trim(); if(!line || /^WEBVTT|^YouTube transcript$|^(Video ID|Language|Captions):/.test(line)) continue;
      if(/^\d+$/.test(line) && /-->/.test(lines[i+1]||'')) continue;
      const range=line.match(/^(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?)/);
      const stamp=line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.*)$/);
      if(range || stamp) {
        const start=seconds((range||stamp)[1]); current={start,duration:range?Math.max(0,seconds(range[2])-start):0,text:range?'':stamp[2]}; segments.push(current);
      } else if(current) current.text+=(current.text?' ':'')+line;
      else {current={start:0,duration:0,text:line};segments.push(current);}
    }
    return segments.filter(x=>x.text);
  }
})();
