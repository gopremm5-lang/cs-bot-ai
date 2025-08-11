(function(){
  const q = document.getElementById('q');
  const sortSel = document.getElementById('sort');
  const pageSizeSel = document.getElementById('pageSize');
  const list = document.getElementById('produkList');
  const cards = Array.from(list.querySelectorAll('.prod-card'));
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const pageInfo = document.getElementById('pageInfo');

  let page = 1;
  function val(sel){ return sel ? sel.value : ''; }

  // actions (toggle & copy)
  list.addEventListener('click', (e)=>{
    const t = e.target;
    if (t.classList.contains('prod-toggle')) {
      const card = t.closest('.prod-card');
      const expanded = card.classList.toggle('expanded');
      t.textContent = expanded ? 'Tampilkan ringkas' : 'Tampilkan selengkapnya';
    }
    if (t.classList.contains('prod-copy')) {
      const txt = t.getAttribute('data-copy') || '';
      navigator.clipboard.writeText(txt).then(()=>{
        t.textContent = 'Tersalin ✓';
        setTimeout(()=> t.textContent = 'Copy', 1200);
      }).catch(()=>{ alert('Gagal menyalin'); });
    }
  });

  function getFiltered(){
    const keyword = (q?.value || '').toLowerCase().trim();
    let arr = cards.slice();
    if (keyword) {
      arr = arr.filter(c=>{
        const name = c.dataset.name.toLowerCase();
        const content = (c.dataset.content || '').toLowerCase();
        return name.includes(keyword) || content.includes(keyword);
      });
    }
    const sort = val(sortSel);
    arr.sort((a,b)=>{
      const an = a.dataset.name.toLowerCase();
      const bn = b.dataset.name.toLowerCase();
      if (sort === 'name-desc') return bn.localeCompare(an);
      return an.localeCompare(bn); // default asc
    });
    return arr;
  }

  function render(){
    const all = getFiltered();
    const size = parseInt(val(pageSizeSel) || '12', 10);
    const totalPages = Math.max(1, Math.ceil(all.length / size));
    if (page > totalPages) page = totalPages;
    const start = (page-1)*size;
    const slice = all.slice(start, start+size);

    // hide all first
    cards.forEach(c => c.style.display = 'none');
    // show slice
    slice.forEach(c => c.style.display = '');

    // pager
    pageInfo.textContent = `Halaman ${page} dari ${totalPages} • ${all.length} item`;
    prevBtn.disabled = (page<=1);
    nextBtn.disabled = (page>=totalPages);
  }

  q?.addEventListener('input', ()=>{ page=1; render(); });
  sortSel?.addEventListener('change', ()=>{ page=1; render(); });
  pageSizeSel?.addEventListener('change', ()=>{ page=1; render(); });
  prevBtn?.addEventListener('click', ()=>{ if (page>1){ page--; render(); }});
  nextBtn?.addEventListener('click', ()=>{ page++; render(); });

  render();
})();
