import {resize,perspective,lookAt,motionButton} from './gl.js';
import {cutoffHz,resonanceDB} from './audio.js';
import {makeJamRenderer,drawVectorPreview} from './jam-render.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function initJam(sound,reduced){
  const get=id=>document.getElementById(id),stage=get('stage'),slot=get('stage-slot'),theater=get('theater'),guide=get('vr-guide');
  const enter=get('vr-enter'),expand=get('field-expand'),motion=get('field-motion'),cutoff=get('cutoff'),resonance=get('resonance');
  const defaultGuide=get('guide-copy').textContent, quiet={low:0,mid:0,high:0};
  const state={time:1.8,x:sound.x,y:sound.y,bands:quiet,step:-1,playing:false,floor:0};
  let canvas=get('field-canvas'),gl=null,ctx=null,render=null,initialized=false,lost=false;
  let session=null,space=null,supported=false,entering=false,resumeOutside=false,held=null,pointer=null;
  let moving=!reduced.matches,visible=false,frame=0,last=0,dirty=true;
  const status=message=>{get('field-status').textContent=message;};
  function advance(now){
    const dt=Math.min(.07,Math.max(0,(now-last)/1000));last=now;
    if(moving)state.time+=dt;
    state.x=sound.x;state.y=sound.y;state.playing=sound.playing;state.bassSteps=sound.gates[0];
    state.step=sound.playing?Math.floor(sound.progress()*16):-1;
    state.motion=moving;state.bands=sound.spectrum();
  }
  function clear(){gl.clearColor(.034,.046,.054,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);}
  function draw(){
    if(!initialized||lost||session)return;
    resize(canvas,1.65);const w=canvas.width,h=canvas.height,ratio=w/Math.max(1,canvas.clientWidth);
    const aspect=w/h, fov=2*Math.atan(Math.max(.99,2.36/aspect)/3.68);
    const projection=perspective(fov,aspect,.05,40),view=lookAt([.22,2.12,1.04],[0,1.13,-2.56]);
    if(render){gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);clear();render(projection,view,state,w,h,ratio);}
    else if(ctx)drawVectorPreview(ctx,projection,view,state,w,h,ratio);
    stage.classList.toggle('rendered',Boolean(render||ctx));
  }
  function tick(now){
    frame=0;if(!visible||document.hidden||session||lost)return;
    if(dirty||now-last>=(moving?32:125)){advance(now);draw();dirty=false;}
    if(moving||sound.playing)frame=requestAnimationFrame(tick);
  }
  function schedule(){
    dirty=true;if(initialized&&!frame&&visible&&!document.hidden&&!session&&!lost)frame=requestAnimationFrame(tick);
  }
  function filters(){
    cutoff.value=String(Math.round(sound.x*1000));resonance.value=String(Math.round(sound.y*1000));
    const hz=cutoffHz(sound.x),q=resonanceDB(sound.y).toFixed(1)+' dB';
    const hzText=hz<1000?hz+' Hz':(hz/1000).toFixed(2)+' kHz';
    get('cutoff-value').value=hzText;get('resonance-value').value=q;
    cutoff.setAttribute('aria-valuetext',hzText);resonance.setAttribute('aria-valuetext',q);schedule();
  }
  for(const el of [cutoff,resonance])el.addEventListener('input',()=>sound.setFilter(Number(cutoff.value)/1000,Number(resonance.value)/1000));
  sound.addEventListener('filter',filters);sound.addEventListener('change',schedule);sound.addEventListener('pattern',schedule);filters();
  function startSound(){return sound.play().catch(e=>status(e.message));}
  function switchPlay(){if(sound.playing)sound.stop();else startSound();}
  function placePointer(event){
    const r=canvas.getBoundingClientRect();sound.setFilter((event.clientX-r.left)/r.width,1-(event.clientY-r.top)/r.height);
  }
  function bindCanvas(){
    canvas.addEventListener('pointerdown',e=>{
      if(!e.isPrimary||e.button!==0)return;pointer=e.pointerId;canvas.setPointerCapture(pointer);placePointer(e);
    });
    canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointer)placePointer(e);});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{pointer=null;});
    canvas.addEventListener('keydown',e=>{
      const delta=e.shiftKey?.08:.015;
      const changes={ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowDown:[0,-delta],ArrowUp:[0,delta]};
      if(changes[e.key]){e.preventDefault();sound.setFilter(sound.x+changes[e.key][0],sound.y+changes[e.key][1]);}
      if(e.key==='Enter'||e.key===' '){e.preventDefault();switchPlay();}
    });
  }
  function setup(){
    if(initialized)return;initialized=true;
    try{gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance'});if(gl)render=makeJamRenderer(gl);}catch{render=null;}
    if(!render){
      if(gl){const copy=canvas.cloneNode(false);canvas.replaceWith(copy);canvas=copy;gl=null;}
      ctx=canvas.getContext('2d');
    }else{
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;stage.classList.remove('rendered');if(session&&!entering)session.end().catch(()=>{});});
      canvas.addEventListener('webglcontextrestored',()=>{try{render=makeJamRenderer(gl);lost=false;schedule();}catch{lost=true;}});
    }
    bindCanvas();advance(performance.now());draw();schedule();
  }
  function setMotion(value){moving=value;motionButton(motion,moving,'도형 움직임');schedule();}
  setMotion(moving);motion.addEventListener('click',()=>setMotion(!moving));
  reduced.addEventListener('change',()=>setMotion(!reduced.matches));
  function expanded(open){
    if(open&&!theater.open){
      theater.append(stage);theater.showModal();document.body.classList.add('locked');
      expand.setAttribute('aria-label','확대 보기 닫기');expand.title='확대 보기 닫기';expand.querySelector('use').setAttribute('href','#i-x');expand.focus({preventScroll:true});
    }else if(!open&&theater.open)theater.close();
    schedule();
  }
  expand.addEventListener('click',()=>expanded(!theater.open));
  theater.addEventListener('close',()=>{
    slot.append(stage);expand.setAttribute('aria-label','공간 확대');expand.title='공간 확대';expand.querySelector('use').setAttribute('href','#i-expand');
    document.body.classList.toggle('locked',Boolean(document.querySelector('dialog[open]')));expand.focus({preventScroll:true});schedule();
  });
  get('guide-preview').addEventListener('click',()=>{guide.close();expanded(true);canvas.focus({preventScroll:true});});
  function showGuide(message=defaultGuide){get('guide-copy').textContent=message;if(!guide.open)guide.showModal();document.body.classList.add('locked');}
  async function checkVR(){
    try{supported=Boolean(navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr'));}catch{supported=false;}
    enter.querySelector('span').textContent=session?'VR 나가기':supported&&render?'VR 연주':'VR 연결 안내';
    get('controller-help').hidden=!(supported&&render);
  }
  // Use a fixed virtual control plane in front of the player so a held ray or
  // tracked hand changes the same filter as the desktop XY surface.
  function rayPoint(frameData,input){
    const pose=frameData.getPose(input.targetRaySpace,space);if(!pose)return null;
    const m=pose.transform.matrix, distance=(m[14]+2.1)/m[10];
    if(m[10]<.08||distance<=0||distance>8)return null;
    return [m[12]-m[8]*distance,m[13]-m[9]*distance];
  }
  function grab(e){
    const from=rayPoint(e.frame,e.inputSource);
    if(from)held={source:e.inputSource,from,x:sound.x,y:sound.y};
  }
  function xrFrame(now,frameData){
    const active=frameData.session;if(active!==session)return;
    active.requestAnimationFrame(xrFrame);
    const pose=frameData.getViewerPose(space),layer=active.renderState.baseLayer;if(!pose||!layer||lost)return;
    if(held){
      const p=rayPoint(frameData,held.source);
      if(p){
        const x=clamp(held.x+(p[0]-held.from[0])*.58,0,1),y=clamp(held.y+(p[1]-held.from[1])*.76,0,1);
        if(Math.abs(sound.x-x)+Math.abs(sound.y-y)>.0009)sound.setFilter(x,y);
      }
    }
    advance(now);gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);clear();
    for(const eye of pose.views){
      const area=layer.getViewport(eye);gl.viewport(area.x,area.y,area.width,area.height);
      render(eye.projectionMatrix,eye.transform.inverse.matrix,state,area.width,area.height,Math.max(1,area.height/700));
    }
  }
  function endVR(){
    session=null;space=null;held=null;sound.immersive=false;entering=false;state.floor=0;
    if(!resumeOutside||document.hidden)sound.stop();
    if(gl&&!lost)gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    enter.disabled=false;checkVR();last=performance.now();schedule();status('VR 연주를 마쳤습니다.');
  }
  enter.addEventListener('click',async()=>{
    setup();if(entering)return;if(session){await session.end();return;}
    if(!render||!supported||lost){showGuide();return;}
    entering=true;enter.disabled=true;resumeOutside=sound.playing;sound.immersive=true;
    try{
      const request=navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor']});
      startSound();
      const active=await request;session=active;active.addEventListener('end',endVR,{once:true});
      await gl.makeXRCompatible();if(session!==active)return;
      const layer=new XRWebGLLayer(active,gl,{antialias:true,framebufferScaleFactor:.9});
      active.updateRenderState({baseLayer:layer,depthNear:.05,depthFar:45});
      try{space=await active.requestReferenceSpace('local-floor');state.floor=0;}
      catch{space=await active.requestReferenceSpace('local');state.floor=-1.56;}
      if(session!==active)return;
      active.addEventListener('selectstart',grab);active.addEventListener('selectend',e=>{if(held?.source===e.inputSource)held=null;});
      active.addEventListener('squeezestart',switchPlay);enter.querySelector('span').textContent='VR 나가기';
      status('VR 연주 중. 트리거를 잡고 움직이면 필터가 변합니다.');last=performance.now();active.requestAnimationFrame(xrFrame);
    }catch{
      if(session){try{await session.end();}catch{endVR();}}else endVR();
      showGuide('헤드셋 연결과 사이트의 VR 권한을 확인해 주세요. 화면에서도 같은 패턴과 필터를 연주할 수 있습니다.');
    }finally{entering=false;enter.disabled=false;}
  });
  navigator.xr?.addEventListener('devicechange',checkVR);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){setup();checkVR();last=performance.now();schedule();}},{rootMargin:'160px'}).observe(stage);
  new ResizeObserver(()=>schedule()).observe(stage);
  document.addEventListener('visibilitychange',()=>{last=performance.now();schedule();});
}
