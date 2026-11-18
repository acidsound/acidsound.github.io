// A one-bar sketch for the portfolio. Its gates and notes also export to acidBros.
export const lanes=['BASS','KICK','SNARE','HAT'];
export const patches=[
  {name:'Acid Drift',bpm:118,notes:[36,36,36,48,39,43,36,34,39,43,46,39,36,48,43,34],gates:[0xd96d,0x1111,0x1010,0xcccc]},
  {name:'Glass Phase',bpm:92,notes:[48,55,60,55,63,60,55,58,50,55,58,53,60,55,62,58],gates:[0x2969,0x0101,0x1010,0x5555]},
  {name:'Cut Sequence',bpm:104,notes:[36,48,43,36,39,46,34,43,36,48,36,46,39,36,43,34],gates:[0x9349,0x4305,0x1010,0xb5aa]}
];
const rate=32000, tau=Math.PI*2;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const cutoffHz=x=>Math.round(90*Math.pow(140,x));
export const resonanceDB=y=>Math.round((.15+15*y)*10)/10;
const hasGate=(word,step)=>Boolean(word & (1<<step));

function renderBar(index,gates) {
  const {bpm,notes}=patches[index], stepSeconds=15/bpm;
  const out=new Float32Array(Math.round(rate*stepSeconds*16));
  for(let lane=0;lane<4;lane++) for(let step=0;step<16;step++){
    if(!hasGate(gates[lane],step))continue;
    const offset=Math.round(step*stepSeconds*rate),freq=440*2**((notes[step]-69)/12);
    const duration=lane===0?stepSeconds*1.34:[0,.25,.18,.092][lane];
    let seed=11387+step*17411+lane*113,prevNoise=0;
    for(let i=0;i<Math.ceil(duration*rate);i++){
      const t=i/rate, attack=Math.min(1,t/.0025),release=Math.min(1,(duration-t)/.011);
      let v=0;
      if(lane===0){
        const p=tau*t*freq;
        if(index===1) v=(Math.sin(p+2.7*Math.sin(p*2)*Math.exp(-t*10))+.23*Math.sin(3*p))*Math.exp(-t*7);
        else {
          for(let h=1;h<=9;h++)v+=Math.sin(p*h)/h*Math.exp(-t*(8+h*2));
        }
        v*=step%4===0?.52:.41;
      }else if(lane===1){
        v=.85*Math.sin(tau*(46*t+1.75*(1-Math.exp(-t*44))))*Math.exp(-t*15);
      }else{
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        const noise=seed/2147483648-1;
        v=lane===2?(.39*noise+.16*Math.sin(tau*177*t))*Math.exp(-t*23):(noise-prevNoise)*.16*Math.exp(-t*50);
        prevNoise=noise;
      }
      out[(offset+i)%out.length]+=v*attack*Math.max(0,release);
    }
  }
  for(let n=0;n<out.length;n++)out[n]=Math.tanh(out[n]*1.26);
  return out;
}

// Blocks follow acidBros/docs/BINARY_FORMAT.md. Absent units use the editor's defaults.
export function editorURL(index,gates,x,y){
  const patch=patches[index], bytes=[];
  const block=(id,data)=>bytes.push(id,data.length&255,data.length>>8,...data);
  block(1,[patch.bpm,50,0,0,1,0]);
  const bass=[1,0,0,10,120,Math.round(100*x),Math.round(15*y),50,50,75,75,0,0,0];
  patch.notes.forEach((note,i)=>bass.push(note,hasGate(gates[0],i)?(i%4===0?3:1):0));
  block(2,bass);
  const drums=[2,0,0,3];
  for(let i=1;i<4;i++)drums.push(i-1,1,gates[i]&255,gates[i]>>8);
  block(2,drums);
  block(3,[131,0,0]); // Visible 909 lanes: bass drum, snare and closed hat.
  block(0,[]);
  const hash=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  return 'https://acidsound.github.io/acidBros/#'+hash;
}

export class SignalPlayer extends EventTarget {
  index=0; playing=false; x=.68; y=.30; context=null; analyser=null; source=null;
  patterns=patches.map(p=>[...p.gates]); rendered=new Map(); intent=0; startedAt=0;
  bands={low:0,mid:0,high:0}; measured=-100;
  get gates(){return this.patterns[this.index];}
  get pcm(){if(!this.rendered.has(this.index))this.rendered.set(this.index,renderBar(this.index,this.gates));return this.rendered.get(this.index);}
  get link(){return editorURL(this.index,this.gates,this.x,this.y);}
  enabled(lane,step){return hasGate(this.gates[lane],step);}
  toggle(lane,step){
    this.gates[lane]^=1<<step;this.rendered.delete(this.index);
    if(this.playing)this.startSource(true);
    this.dispatchEvent(new Event('pattern'));
  }
  setPatch(index) {
    this.index=index;
    if(this.playing)this.startSource(false);
    this.dispatchEvent(new Event('pattern'));
  }
  setFilter(x,y){
    this.x=clamp(x,0,1);this.y=clamp(y,0,1);
    if(this.filter){
      const now=this.context.currentTime;
      this.filter.frequency.setTargetAtTime(cutoffHz(this.x),now,.018);
      this.filter.Q.setTargetAtTime(resonanceDB(this.y),now,.018);
    }
    this.dispatchEvent(new Event('filter'));
  }
  ensureGraph(){
    if(this.context)return;
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)throw Error('이 브라우저에서는 오디오를 재생할 수 없습니다.');
    const ctx=this.context=new Audio();
    this.filter=ctx.createBiquadFilter();this.filter.type='lowpass';
    this.filter.frequency.value=cutoffHz(this.x);this.filter.Q.value=resonanceDB(this.y);
    this.analyser=ctx.createAnalyser();this.analyser.fftSize=1024;this.analyser.smoothingTimeConstant=.59;
    this.analyser.minDecibels=-80;this.analyser.maxDecibels=-12;
    this.bins=new Uint8Array(this.analyser.frequencyBinCount);
    const limit=ctx.createDynamicsCompressor();limit.threshold.value=-13;limit.knee.value=9;limit.ratio.value=6;
    const output=ctx.createGain();output.gain.value=.38;
    this.filter.connect(this.analyser).connect(limit).connect(output).connect(ctx.destination);
  }
  fadeOld(now){
    const old=this.source;
    if(!old)return;
    old.gain.gain.cancelScheduledValues(now);old.gain.gain.setValueAtTime(old.gain.gain.value,now);
    old.gain.gain.linearRampToValueAtTime(0,now+.012);old.node.stop(now+.014);this.source=null;
  }
  startSource(keepPhase){
    const ctx=this.context,now=ctx.currentTime,phase=keepPhase?this.progress():0;
    const pcm=this.pcm,buf=ctx.createBuffer(1,pcm.length,rate);buf.copyToChannel(pcm,0);
    const node=ctx.createBufferSource(),gain=ctx.createGain();node.buffer=buf;node.loop=true;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(1,now+.012);
    node.connect(gain).connect(this.filter);node.onended=()=>{node.disconnect();gain.disconnect();};
    this.fadeOld(now);node.start(now,phase*buf.duration);this.startedAt=now-phase*buf.duration;
    this.source={node,gain,duration:buf.duration};
  }
  async play(){
    if(this.playing)return;
    const attempt=++this.intent;this.dispatchEvent(new Event('starting'));
    this.ensureGraph();await this.context.resume();
    if(attempt!==this.intent)return;
    if(this.context.state!=='running')throw Error('브라우저의 오디오 재생 권한을 확인해 주세요.');
    this.startSource(false);this.playing=true;this.dispatchEvent(new Event('change'));
  }
  stop(){
    const stopped=++this.intent;
    if(this.context){
      this.fadeOld(this.context.currentTime);
      // Let the final envelope reach zero before releasing the output device.
      setTimeout(()=>{
        if(stopped===this.intent&&this.context.state==='running')this.context.suspend().catch(()=>{});
      },45);
    }
    this.playing=false;this.bands={low:0,mid:0,high:0};this.dispatchEvent(new Event('change'));
  }
  progress(){
    return this.source?Math.max(0,(this.context.currentTime-this.startedAt)/this.source.duration)%1:0;
  }
  spectrum(){
    if(!this.playing||!this.analyser)return this.bands;
    const now=performance.now();if(now-this.measured<12)return this.bands;
    this.measured=now;this.analyser.getByteFrequencyData(this.bins);
    const hz=this.context.sampleRate/this.analyser.fftSize;
    const band=(lo,hi)=>{
      const from=Math.max(1,Math.floor(lo/hz)),to=Math.min(this.bins.length,Math.ceil(hi/hz));
      let sum=0;for(let i=from;i<to;i++)sum+=(this.bins[i]/255)**2;
      return Math.sqrt(sum/Math.max(1,to-from));
    };
    this.bands={low:band(36,190),mid:band(190,1900),high:band(1900,10000)};
    return this.bands;
  }
}
