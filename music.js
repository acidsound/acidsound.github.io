export function initMusic(sound) {
  const release=document.getElementById('music'), buttons=Array.from(release.querySelectorAll('.listen-button'));
  let current=null;
  function close(){
    if(!current)return;
    const host=document.getElementById(current.getAttribute('aria-controls'));
    host.replaceChildren();host.hidden=true;current.setAttribute('aria-expanded','false');
    current.querySelector('use').setAttribute('href','#i-play');current=null;
  }
  for(const button of buttons)button.addEventListener('click',()=>{
    const already=current===button;close();if(already)return;
    sound.stop();
    const host=document.getElementById(button.getAttribute('aria-controls')),frame=document.createElement('iframe');
    const url=new URL('https://w.soundcloud.com/player/');
    url.search=new URLSearchParams({url:'https://api.soundcloud.com/tracks/'+button.dataset.track,color:'#ff6633',auto_play:'true',hide_related:'true',show_comments:'false',show_user:'true',show_reposts:'false',show_teaser:'false',visual:'false'}).toString();
    frame.src=url.href;frame.allow='autoplay';frame.title=button.dataset.title+' · SoundCloud 공식 플레이어';
    frame.referrerPolicy='strict-origin-when-cross-origin';host.append(frame);host.hidden=false;
    button.setAttribute('aria-expanded','true');button.querySelector('use').setAttribute('href','#i-x');current=button;
  });
  sound.addEventListener('starting',close);window.addEventListener('pagehide',close);
}
