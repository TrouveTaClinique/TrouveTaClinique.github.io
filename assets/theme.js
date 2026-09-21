document.documentElement.classList.add('js');
(function(){
  function toutReveler(){
    document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('vu')});
  }
  try{
    var h=document.querySelector('header.site');
    if(h){
      addEventListener('scroll',function(){h.classList.toggle('scrolled',scrollY>4)},{passive:true});
    }
    if(!('IntersectionObserver' in window)){ toutReveler(); return; }
    var io=new IntersectionObserver(function(es){es.forEach(function(e){
      if(e.isIntersecting){e.target.classList.add('vu');}else{e.target.classList.remove('vu');}});},
      {rootMargin:'0px 0px -10% 0px',threshold:.08});
    document.querySelectorAll('.reveal').forEach(function(el){io.observe(el)});
  }catch(e){ toutReveler(); }
})();
