import {lanes,patches} from './audio.js';

export function initPattern(sound,reduced) {
  const byId=id=>document.getElementById(id), panel=byId('pattern'), grid=byId('pattern-grid');
  const scope=byId('scope'), ctx=scope.getContext('2d'), pager=byId('step-pages');
  const openEditor=byId('edit-in-acidbros'), select=byId('pattern-preset'), buttons=[];
  let half=0, compact=false, frame=0, visible=true, lastPaint=0, step=-1, envelope=[];
  function setHalf(value) {
    half=value;grid.dataset.half=String(half);
    Array.from(pager.children).forEach((button,i)=>button.setAttribute('aria-pressed',String(half===i)));
    for(const row of buttons)row.forEach((button,i)=>button.tabIndex=(i===(compact?half*8:0)?0:-1));
  }
  for(const [lane,name] of lanes.entries()){
    const line=document.createElement('div');line.className='step-row lane-'+lane;
    line.setAttribute('role','group');line.setAttribute('aria-label',name);
    const label=document.createElement('span');label.className='lane-name';label.textContent=name;line.append(label);
    const row=[];
    for(let i=0;i<16;i++){
      const button=document.createElement('button');button.className='step-pad';
      button.dataset.bank=String(i>>3);button.dataset.step=String(i);button.setAttribute('aria-label',name+' '+(i+1)+'번 스텝');
      button.addEventListener('click',()=>sound.toggle(lane,i));
      button.addEventListener('keydown',event=>{
        const directions={ArrowLeft:[lane,(i+15)%16],ArrowRight:[lane,(i+1)%16],ArrowUp:[(lane+3)%4,i],ArrowDown:[(lane+1)%4,i],Home:[lane,0],End:[lane,15]};
        const dest=directions[event.key];if(!dest)return;event.preventDefault();
        if(compact)setHalf(dest[1]>>3);
        buttons[dest[0]][dest[1]].focus();
      });
      row.push(button);line.append(button);
    }
    buttons.push(row);grid.append(line);
  }
  for(const [i,button] of Array.from(pager.children).entries())button.addEventListener('click',()=>setHalf(i));
  for(const [i,patch] of patches.entries()){const option=new Option(patch.name+'  /  '+patch.bpm+' BPM',String(i));select.add(option);}
  select.addEventListener('change',()=>sound.setPatch(Number(select.value)));
  function measure() {
    const count=Math.max(96,Math.floor(scope.clientWidth*.78)), data=sound.pcm;
    envelope=Array.from({length:count},(_,i)=>{
      const a=Math.floor(i*data.length/count),b=Math.floor((i+1)*data.length/count);
      let lo=0,hi=0;for(let n=a;n<b;n+=3){lo=Math.min(lo,data[n]);hi=Math.max(hi,data[n]);}
      return [lo,hi];
    });
  }
  function paint(){
    if(!ctx)return;
    const w=scope.clientWidth,h=scope.clientHeight,d=Math.min(devicePixelRatio||1,2);if(!w||!h)return;
    if(scope.width!==Math.round(w*d)||scope.height!==Math.round(h*d)){scope.width=Math.round(w*d);scope.height=Math.round(h*d);measure();}
    ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);
    const left=7,right=w-7,span=right-left,mid=h*.54;
    const progress=sound.progress();
    ctx.strokeStyle='#484839';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(left,mid);ctx.lineTo(right,mid);ctx.stroke();
    const hasSound=envelope.some(([lo,hi])=>hi-lo>.001);
    if(hasSound){
      const stride=span/envelope.length;
      envelope.forEach(([lo,hi],i)=>{
        const x=left+(i+.5)*stride;
        ctx.fillStyle=sound.playing&&i/envelope.length<progress?'#ffd589':'#ff8044';
        ctx.fillRect(x,mid-hi*h*.58,Math.max(1,stride*.65),Math.max(.6,(hi-lo)*h*.58));
      });
    }
    if(sound.playing){
      const x=left+span*progress;ctx.strokeStyle='#fff4be';ctx.lineWidth=1.25;ctx.beginPath();ctx.moveTo(x,2);ctx.lineTo(x,h-2);ctx.stroke();
    }
    const next=sound.playing?Math.floor(progress*16):-1;
    if(next!==step){
      if(step>=0)for(const row of buttons)row[step].classList.remove('playhead');
      if(next>=0)for(const row of buttons)row[next].classList.add('playhead');
      step=next;byId('step-readout').textContent=next<0?'— / 16':String(next+1).padStart(2,'0')+' / 16';
    }
  }
  function tick(now){frame=0;if(!visible||document.hidden||!sound.playing)return;if(now-lastPaint>=(reduced.matches?100:30)){paint();lastPaint=now;}frame=requestAnimationFrame(tick);}
  function refresh(){
    measure();buttons.forEach((row,l)=>row.forEach((b,i)=>b.setAttribute('aria-pressed',String(sound.enabled(l,i)))));
    select.value=String(sound.index);byId('pattern-name').textContent=patches[sound.index].bpm+' BPM';
    openEditor.href=sound.link;paint();
  }
  const toggles=[byId('audio-toggle'),byId('jam-play')], globalStop=byId('global-stop');
  function state(){
    for(const button of toggles) {
      button.setAttribute('aria-pressed',String(sound.playing));
      button.setAttribute('aria-label',sound.playing?'패턴 정지':'패턴 재생');
      button.querySelector('use').setAttribute('href',sound.playing?'#i-pause':'#i-play');
      button.querySelector('.play-label').textContent=sound.playing?'정지':'재생';
    }
    byId('scope-state').textContent=sound.playing?'PLAY':'STOP';
    globalStop.hidden=!sound.playing;paint();if(sound.playing&&!frame)frame=requestAnimationFrame(tick);
  }
  for(const button of toggles)button.addEventListener('click',async()=>{
    button.disabled=true;
    try{if(sound.playing)sound.stop();else await sound.play();byId('audio-status').textContent=sound.playing?'패턴 재생 중':'패턴 정지';}
    catch(e){byId('audio-status').textContent=e.message;byId('field-status').textContent=e.message;}
    finally{button.disabled=false;}
  });
  globalStop.addEventListener('click',()=>sound.stop());
  sound.addEventListener('change',state);sound.addEventListener('pattern',refresh);
  sound.addEventListener('filter',()=>{openEditor.href=sound.link;});
  new ResizeObserver(()=>{const width=panel.clientWidth;compact=width<=480;grid.classList.toggle('compact',compact);pager.hidden=!compact;setHalf(half);measure();paint();}).observe(panel);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){paint();if(sound.playing&&!frame)frame=requestAnimationFrame(tick);}}).observe(panel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!sound.immersive)sound.stop();});
  window.addEventListener('pagehide',()=>sound.stop());setHalf(0);refresh();state();
}
