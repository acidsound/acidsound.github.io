import { SignalPlayer } from './audio.js';
import { initPattern } from './pattern.js';
import { initMusic } from './music.js';
import { initJam } from './jam.js';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const sound=new SignalPlayer();
initPattern(sound,reduced);
initMusic(sound);
initJam(sound,reduced);

const contact=document.getElementById('contact-dialog');
const menu=document.getElementById('main-nav'), menuToggle=document.getElementById('menu-toggle');
function setMenu(open){
  menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');
  menuToggle.querySelector('use').setAttribute('href',open?'#i-x':'#i-menu');
  menu.classList.toggle('open',open);
}
menuToggle.addEventListener('click',()=>setMenu(!menu.classList.contains('open')));
menu.addEventListener('click',()=>setMenu(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.classList.contains('open')){setMenu(false);menuToggle.focus();}});
document.addEventListener('click',event=>{
  if(!event.target.closest('.masthead') && menu.classList.contains('open'))setMenu(false);
  const link=event.target.closest('a');
  if(link?.hasAttribute('data-contact') && typeof contact.showModal==='function' && !event.ctrlKey && !event.metaKey && !event.shiftKey){
    event.preventDefault();setMenu(false);contact.showModal();document.body.classList.add('locked');
  }
  if(link?.target==='_blank' && sound.playing)sound.stop();
  if(event.target.closest('[data-close]'))event.target.closest('dialog')?.close();
});
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.addEventListener('close',()=>document.body.classList.toggle('locked',Boolean(document.querySelector('dialog[open]'))));
  if(dialog.id!=='theater')dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
});
const sectionNav=Array.from(menu.querySelectorAll('a'));
const sectionObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){
    const link=sectionNav.find(a=>a.hash==='#'+entry.target.id);
    if(entry.isIntersecting){
      sectionNav.forEach(a=>a.removeAttribute('aria-current'));
      link?.setAttribute('aria-current','location');
    }else link?.removeAttribute('aria-current');
  }
},{rootMargin:'-15% 0px -54% 0px'});
for(const link of sectionNav)sectionObserver.observe(document.getElementById(link.hash.slice(1)));
