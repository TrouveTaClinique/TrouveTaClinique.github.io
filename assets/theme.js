document.documentElement.classList.add('js');
(function(){
  var h=document.querySelector('header.site');
  addEventListener('scroll',function(){h.classList.toggle('scrolled',scrollY>4)},{passive:true});
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    if(e.isIntersecting){e.target.classList.add('vu');io.unobserve(e.target);}});},
    {rootMargin:'0px 0px -10% 0px',threshold:.08});
  document.querySelectorAll('.reveal').forEach(function(el){io.observe(el)});
})();
