(function(){
  const app = document.documentElement; // gunakan attribute di <html>
  // init state
  const collapsed = localStorage.getItem('sidebar_collapsed') === '1';
  if (collapsed) app.setAttribute('data-collapsed','true');

  // mobile overlay state
  let open = false;

  // toggle
  const btn = document.getElementById('btnSidebar');
  if (btn){
    btn.addEventListener('click', () => {
      if (window.matchMedia('(max-width:1100px)').matches){
        open = !open;
        if (open) app.setAttribute('data-open','true'); else app.removeAttribute('data-open');
      } else {
        const now = app.getAttribute('data-collapsed') === 'true';
        if (now){ app.removeAttribute('data-collapsed'); localStorage.setItem('sidebar_collapsed','0'); }
        else { app.setAttribute('data-collapsed','true'); localStorage.setItem('sidebar_collapsed','1'); }
      }
    });
  }

  // active link (top + side)
  const path = location.pathname.replace(/\/+$/,'') || '/dashboard';
  document.querySelectorAll('.nav-links a, .sidebar a').forEach(a=>{
    const href = a.getAttribute('href');
    if (!href) return;
    const norm = href.replace(/\/+$/,'');
    if (norm && path.startsWith(norm)) a.classList.add('active');
  });

  // close sidebar on route change in mobile
  window.addEventListener('click', (e)=>{
    if (!open) return;
    const aside = document.querySelector('.sidebar');
    if (!aside) return;
    if (!aside.contains(e.target) && e.target !== btn){
      open = false; app.removeAttribute('data-open');
    }
  });
})();
