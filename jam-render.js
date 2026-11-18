import {buffer,makeProgram,cross,unit} from './gl.js';

const tau=Math.PI*2, orange=[1,.38,.085], mint=[.24,.99,.70], violet=[.71,.49,1], brass=[.90,.67,.30];
const mesh=()=>({lines:[],triangles:[]});
const edge=(g,a,b)=>g.lines.push([a,b]);
function face(g,a,b,c){
  const normal=unit(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i])));
  for(const vertex of [a,b,c])g.triangles.push(...vertex,...normal);
}
function ring(g,fn,n=48){
  let a=fn(0);
  for(let i=1;i<=n;i++){const b=fn(i/n);edge(g,a,b);a=b;}
}
function box(cages=false){
  const g=mesh(),v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  for(const [a,b,c,d] of [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[4,5,1,0],[3,2,6,7]]){face(g,v[a],v[b],v[c]);face(g,v[a],v[c],v[d]);}
  for(const [a,b] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]])edge(g,v[a],v[b]);
  if(cages)for(const y of [-.57,-.16,.25,.65])for(const [a,b] of [[0,1],[1,5],[5,4],[4,0]])edge(g,[v[a][0],y,v[a][2]],[v[b][0],y,v[b][2]]);
  return g;
}
function sphere(){
  const g=mesh(),at=(lon,lat)=>[Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)];
  for(let j=0;j<10;j++)for(let i=0;i<24;i++){
    const l=(j/10-.5)*Math.PI,L=((j+1)/10-.5)*Math.PI,a=i/24*tau,b=(i+1)/24*tau;
    const p=at(a,l),q=at(b,l),r=at(b,L),s=at(a,L);
    face(g,p,q,r);face(g,p,r,s);
    if(j>0)edge(g,p,q);if(i%2===0)edge(g,p,s);
  }
  return g;
}
function diamond(){
  const g=mesh(),top=[0,1.2,0],bottom=[0,-1.2,0];
  for(let i=0;i<4;i++){
    const a=[Math.cos(i*tau/4),0,Math.sin(i*tau/4)],b=[Math.cos((i+1)*tau/4),0,Math.sin((i+1)*tau/4)];
    edge(g,a,b);edge(g,a,top);edge(g,a,bottom);face(g,a,b,top);face(g,b,a,bottom);
    for(const f of [.33,.67])for(const tip of [top,bottom]){
      const mix=v=>v.map((k,j)=>k*(1-f)+tip[j]*f);edge(g,mix(a),mix(b));
    }
  }
  return g;
}
function dial(){
  const g=mesh(),at=(t,y)=>[Math.sin(t*tau),y,Math.cos(t*tau)];
  ring(g,t=>at(t,.72));ring(g,t=>at(t,0));
  for(let i=0;i<36;i++){
    const a=at(i/36,.72),b=at((i+1)/36,.72),c=at(i/36,0);
    face(g,a,[0,.72,0],b);face(g,a,b,c);face(g,b,at((i+1)/36,0),c);
    if(i%2===0)edge(g,c,a);
  }
  edge(g,[0,.73,.33],[0,.73,.88]);return g;
}
function wiring(){
  const g=mesh();
  for(let i=-12;i<=12;i++){edge(g,[i*.47,0,-9],[i*.47,0,3]);edge(g,[-6,0,i*.47-3],[6,0,i*.47-3]);}
  // PCB traces connect the three voice stands to the filter controls.
  for(let i=0;i<7;i++)for(const side of [-1,1]){
    const x=side*(1+i*.11),z=-2.66-i*.047;
    const pts=[[x,.735,z],[x,.735,-2.12],[side*(.67+i*.075),.735,-1.83],[side*(.67+i*.075),.735,-1.59]];
    for(let j=1;j<pts.length;j++)edge(g,pts[j-1],pts[j]);
  }
  return g;
}
const circle=mesh();ring(circle,t=>[Math.cos(t*tau),0,Math.sin(t*tau)],80);
const ticks=mesh();for(let i=0;i<=20;i++){
  const a=(-.79+i/20*1.58)*Math.PI;edge(ticks,[Math.sin(a)*.86,.01,Math.cos(a)*.86],[Math.sin(a),.01,Math.cos(a)]);
}
const shapes={box:box(),cube:box(true),orb:sphere(),oct:diamond(),dial:dial(),circle,ticks,wiring:wiring()};
function matrix(pos,scale,angles){
  const [x,y,z]=angles,[sx,sy,sz]=scale,A=Math.cos(x),B=Math.sin(x),C=Math.cos(y),D=Math.sin(y),E=Math.cos(z),F=Math.sin(z);
  return new Float32Array([C*E*sx,(A*F+B*D*E)*sx,(B*F-A*D*E)*sx,0,-C*F*sy,(A*E-B*D*F)*sy,(B*E+A*D*F)*sy,0,D*sz,-B*C*sz,A*C*sz,0,...pos,1]);
}
const zero=[0,0,0];
function composition(state){
  const {time,x,y,bands,step,playing}=state, f=state.floor;
  const items=[];
  function add(key,pos,scale,color,light,rotation=zero,width=1){
    items.push({key,m:matrix([pos[0],pos[1]+f,pos[2]],scale,rotation),color,light,width});
  }
  add('wiring',zero,[1,1,1],[.20,.38,.37],.56,zero,.60);
  add('box',[0,.63,-2.47],[2.39,.088,.96],[.29,.43,.39],.71,zero,.76);
  const xs=[-1.42,0,1.42],colors=[orange,mint,violet],levels=[bands.low,bands.mid,bands.high];
  for(let i=0;i<3;i++){
    const energy=levels[i],v=state.motion?energy:0,color=colors[i],cx=xs[i];
    const light=state.motion?energy:energy*.38;
    add('circle',[cx,.73,-2.64],[.62,1,.50],color,.29+.47*light,zero,.72);
    add('circle',[cx,.735,-2.64],[.53,1,.43],color,.36+.40*light,zero,.65);
    const size=[.36,.43,.425][i]*(1+v*[.52,.38,.55][i]);
    const rotation=[[.24+v*.08,time*.14+.60,-.11],[.16,time*.13+.23,-.21],[-.12,time*-.19+.37,.16+v*.23]][i];
    const center=[cx,1.40+.22*v,-2.67];
    add(['cube','orb','oct'][i],center,[size,size,size],color,1.15+.9*light,rotation,1.08);
    if(i===1)add('circle',center,[size*1.35,1,size*1.35],mint,.68+light,[.46,0,-.25],.80);
    if(i===2)add('circle',center,[size*1.23,1,size*1.23],violet,.48+light,[.04,.15,.35],.67);
  }
  for(const [i,value] of [x,y].entries()){
    const cx=i===0?-1.48:1.48,c=i===0?orange:mint;
    add('ticks',[cx,.733,-1.79],[.30,1,.30],c,.75,zero,.7);
    add('dial',[cx,.732,-1.79],[.212,.17,.212],c,.92,[0,(value-.5)*4.8,0],.92);
  }
  for(let i=0;i<16;i++){
    const current=playing&&step===i,enabled=Boolean(state.bassSteps&(1<<i));
    const cx=(i-7.5)*.121+(Math.floor(i/4)-1.5)*.052;
    add('box',[cx,.758,-1.70],[.044,.023,.068],current?mint:enabled?orange:brass,current?2.1:enabled?1.18:.35,zero,.83);
  }
  return items;
}
const faceVert=`
attribute vec3 pos,norm;uniform mat4 model,view,projection;varying vec3 normal;
void main(){normal=normalize(mat3(model)*norm);gl_Position=projection*view*model*vec4(pos,1.);}`;
const faceFrag=`
precision mediump float;uniform vec3 color;uniform float level;varying vec3 normal;
void main(){float l=abs(dot(normalize(normal),normalize(vec3(-.5,.8,.45))));gl_FragColor=vec4(vec3(.020,.028,.034)+color*(.032+.125*l*l)*min(level,1.6),1.);}`;
const lineVert=`
attribute vec3 start,end;attribute vec2 corner;uniform mat4 model,view,projection;uniform vec2 viewport;uniform float radius;varying float edgeDistance;
void main(){
  vec4 a=view*model*vec4(start,1.),b=view*model*vec4(end,1.);
  if(a.z>-.05&&b.z>-.05){gl_Position=vec4(2.,2.,2.,1.);edgeDistance=1.;return;}
  if(a.z>-.05)a=mix(b,a,(-.05-b.z)/(a.z-b.z));
  if(b.z>-.05)b=mix(a,b,(-.05-a.z)/(b.z-a.z));
  a=projection*a;b=projection*b;
  vec2 delta=(b.xy/b.w-a.xy/a.w)*viewport;
  vec2 axis=delta/max(length(delta),.001),n=vec2(-axis.y,axis.x);
  vec4 at=mix(a,b,corner.x);
  at.xy+=n*corner.y*radius*2./viewport*at.w;
  at.z-=.00009*at.w;
  edgeDistance=corner.y;gl_Position=at;
}`;
const lineFrag=`
precision mediump float;uniform vec3 color;uniform float level;varying float edgeDistance;
void main(){float e=abs(edgeDistance);float core=1.-smoothstep(.02,.29,e);float glow=exp(-5.8*e)*(1.-smoothstep(.62,1.,e));
vec3 c=(mix(color,vec3(1.),.14)*core+color*glow*.46)*level;gl_FragColor=vec4(c,1.);}`;

export function makeJamRenderer(gl){
  const faces=makeProgram(gl,faceVert,faceFrag),lines=makeProgram(gl,lineVert,lineFrag);
  function locations(program,attributes,uniforms){
    return {a:Object.fromEntries(attributes.map(k=>[k,gl.getAttribLocation(program,k)])),u:Object.fromEntries(uniforms.map(k=>[k,gl.getUniformLocation(program,k)]))};
  }
  const frameUniforms=['projection','view','model','color','level'];
  const F=locations(faces,['pos','norm'],frameUniforms),L=locations(lines,['start','end','corner'],[...frameUniforms,'viewport','radius']);
  const gpu={};
  for(const [key,g] of Object.entries(shapes)){
    const vertices=[];for(const [a,b] of g.lines)for(const [t,side] of [[0,-1],[1,-1],[1,1],[0,-1],[1,1],[0,1]])vertices.push(...a,...b,t,side);
    gpu[key]={f:buffer(gl,gl.ARRAY_BUFFER,new Float32Array(g.triangles)),fc:g.triangles.length/6,l:buffer(gl,gl.ARRAY_BUFFER,new Float32Array(vertices)),lc:vertices.length/8};
  }
  function attribute(id,size,stride,offset){gl.enableVertexAttribArray(id);gl.vertexAttribPointer(id,size,gl.FLOAT,false,stride,offset);}
  return (projection,view,state,width,height,pixelRatio)=>{
    const items=composition(state);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.useProgram(faces);
    gl.uniformMatrix4fv(F.u.projection,false,projection);gl.uniformMatrix4fv(F.u.view,false,view);
    for(const item of items){
      const g=gpu[item.key];if(!g.fc)continue;
      gl.uniformMatrix4fv(F.u.model,false,item.m);gl.uniform3fv(F.u.color,item.color);gl.uniform1f(F.u.level,item.light);
      gl.bindBuffer(gl.ARRAY_BUFFER,g.f);attribute(F.a.pos,3,24,0);attribute(F.a.norm,3,24,12);gl.drawArrays(gl.TRIANGLES,0,g.fc);
    }
    gl.disableVertexAttribArray(F.a.pos);gl.disableVertexAttribArray(F.a.norm);
    gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.useProgram(lines);
    gl.uniformMatrix4fv(L.u.projection,false,projection);gl.uniformMatrix4fv(L.u.view,false,view);gl.uniform2f(L.u.viewport,width,height);
    for(const item of items){
      const g=gpu[item.key];
      gl.uniformMatrix4fv(L.u.model,false,item.m);gl.uniform3fv(L.u.color,item.color);gl.uniform1f(L.u.level,item.light);
      gl.uniform1f(L.u.radius,3.1*pixelRatio*item.width);
      gl.bindBuffer(gl.ARRAY_BUFFER,g.l);attribute(L.a.start,3,32,0);attribute(L.a.end,3,32,12);attribute(L.a.corner,2,32,24);
      gl.drawArrays(gl.TRIANGLES,0,g.lc);
    }
    for(const id of Object.values(L.a))gl.disableVertexAttribArray(id);
    gl.disable(gl.BLEND);gl.depthMask(true);
  };
}
function transform(m,v){
  const [x,y,z,w=1]=v;return [0,1,2,3].map(i=>m[i]*x+m[i+4]*y+m[i+8]*z+m[i+12]*w);
}
export function drawVectorPreview(ctx,projection,view,state,w,h,ratio){
  ctx.fillStyle='#0b1014';ctx.fillRect(0,0,w,h);
  for(const item of composition(state)){
    const path=new Path2D();
    function project(v){
      const p=transform(projection,transform(view,transform(item.m,v)));return p[3]>.05?[(p[0]/p[3]*.5+.5)*w,(.5-p[1]/p[3]*.5)*h]:null;
    }
    for(const [from,to] of shapes[item.key].lines){
      const a=project(from),b=project(to);if(a&&b){path.moveTo(...a);path.lineTo(...b);}
    }
    const rgb=item.color.map(v=>Math.round(v*255)).join(',');
    ctx.strokeStyle='rgba('+rgb+','+Math.min(1,.73*item.light)+')';ctx.lineWidth=ratio*item.width;ctx.stroke(path);
  }
}
