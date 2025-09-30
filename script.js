    // Simple Smart Study Planner — single-file
    const $ = (id) => document.getElementById(id);
    const addBtn = $('addBtn');
    const modal = $('modal');
    const closeModal = $('closeModal');
    const saveBtn = $('saveBtn');
    const cards = $('cards');
    const timeline = $('timeline');
    const timelineGrid = $('timelineGrid');
    const listViewBtn = $('listViewBtn');
    const cardViewBtn = $('cardViewBtn');
    const timelineViewBtn = $('timelineViewBtn');
    const notifyToggle = $('notifyToggle');
    const searchInput = $('search');
    const clearSearch = $('clearSearch');
    const sortSelect = $('sort');
    const todayLabel = $('todayLabel');

    const STORAGE_KEY = 'smart-study-planner-v1';
    let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    let editingId = null;
    let remindersEnabled = false;

    // initial UI state
    todayLabel.textContent = new Date().toLocaleDateString();
    $('overallProgress').style.width = '0%';

    function saveAll(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); render(); }

    function uid(){ return 't_'+Math.random().toString(36).slice(2,9); }

    function openModal(task){ modal.style.display='grid';
      if(task){ editingId = task.id; $('title').value=task.title; $('tag').value=task.tag || ''; $('due').value=task.due||''; $('hours').value=task.hours||''; $('notes').value=task.notes||''; }
      else{ editingId=null; $('title').value=''; $('tag').value=''; $('due').value=''; $('hours').value=''; $('notes').value=''; }
    }
    function closeModalNow(){ modal.style.display='none'; editingId=null; }

    addBtn.addEventListener('click', ()=>openModal());
    closeModal.addEventListener('click', closeModalNow);

    saveBtn.addEventListener('click', ()=>{
      const title = $('title').value.trim(); if(!title){ alert('Please enter a title'); return; }
      const tag = $('tag').value.trim(); const due = $('due').value; const hours = $('hours').value; const notes = $('notes').value;
      if(editingId){ const t = tasks.find(x=>x.id===editingId); Object.assign(t,{title,tag,due,hours,notes}); }
      else{ const newTask={id:uid(),title,tag,due,notes,hours:hours||0,done:false,progress:0,created:new Date().toISOString()}; tasks.push(newTask); scheduleReminderFor(newTask);}      
      saveAll(); closeModalNow();
    });

    function render(){
      // apply search & filters & sort
      let q = searchInput.value.trim().toLowerCase();
      let view = localStorage.getItem('ss_view')||'cards';
      // sort
      const sort = sortSelect.value;
      let visible = tasks.slice();
      if(q) visible = visible.filter(t=> (t.title+t.tag+t.notes).toLowerCase().includes(q));
      if(sort==='dateAsc') visible.sort((a,b)=> (a.due||'') > (b.due||'')?1:-1);
      if(sort==='dateDesc') visible.sort((a,b)=> (a.due||'') < (b.due||'')?1:-1);
      if(sort==='priority') visible.sort((a,b)=> (b.hours||0)-(a.hours||0));
      if(sort==='progress') visible.sort((a,b)=> (b.progress||0)-(a.progress||0));

      // stats
      const total = tasks.length; const done = tasks.filter(t=>t.done).length;
      $('statsCount').textContent = total + ' tasks';
      $('completedCount').textContent = done + ' done';
      $('overallProgress').style.width = total? Math.round((done/total)*100)+'%':'0%';

      // tags list
      const tagSet = new Set(); tasks.forEach(t=>{ if(t.tag) t.tag.split(',').forEach(x=>tagSet.add(x.trim())); });
      const tagList = $('tagList'); tagList.innerHTML = ''; tagSet.forEach(tag=>{ const el = document.createElement('span'); el.className='chip'; el.textContent=tag; el.onclick=()=>{ searchInput.value=tag; render(); }; tagList.appendChild(el); });

      // render cards
      cards.innerHTML='';
      visible.forEach(t=>{
        const el = document.createElement('div'); el.className='task';
        el.innerHTML = `<h3>${escapeHtml(t.title)}</h3>
                        <div class="meta"><span class="tag">${escapeHtml(t.tag||'General')}</span><small class="small">${t.due? formatDate(t.due):'No due'}</small></div>
                        <div class="small" style="margin-top:8px">${escapeHtml(t.notes||'')}</div>
                        <div class="actions">
                          <button class="btn" data-id="${t.id}" data-action="toggle">${t.done? 'Undo':'Done'}</button>
                          <button class="btn" data-id="${t.id}" data-action="edit">Edit</button>
                          <button class="btn" data-id="${t.id}" data-action="del">Delete</button>
                        </div>
                        <div style="margin-top:10px">
                          <div class="progress-mini"><i style="width:${t.progress|| (t.done?100:0)}%; background: linear-gradient(90deg, var(--accent), #30d0ff);"></i></div>
                        </div>`;
        cards.appendChild(el);
      });

      // attach actions
      cards.querySelectorAll('button').forEach(btn=>{
        btn.onclick = (e)=>{
          const id = btn.dataset.id; const action = btn.dataset.action;
          if(action==='toggle'){ const t = tasks.find(x=>x.id===id); t.done=!t.done; if(t.done) t.progress=100; saveAll(); }
          if(action==='edit'){ const t = tasks.find(x=>x.id===id); openModal(t); }
          if(action==='del'){ if(confirm('Delete this task?')){ tasks = tasks.filter(x=>x.id!==id); saveAll(); }}
        }
      });

      // timeline render
      renderTimeline(visible);

      // view mode
      if(view==='cards'){ cards.style.display='grid'; timeline.style.display='none'; }
      if(view==='timeline'){ cards.style.display='none'; timeline.style.display='block'; }
    }

    function renderTimeline(list){
      // show 10-day sliding window from today
      const days = [];
      const start = new Date(); start.setHours(0,0,0,0);
      for(let i=0;i<4;i++){ const d = new Date(start); d.setDate(start.getDate()+i); days.push(d); }
      timelineGrid.innerHTML='';
      days.forEach(d=>{
        const col = document.createElement('div'); col.className='day';
        const dayLabel = d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
        col.innerHTML = `<h4>${dayLabel}</h4>`;
        const pins = list.filter(t=>{
          if(!t.due) return false; const td = new Date(t.due); return td.getFullYear()===d.getFullYear() && td.getMonth()===d.getMonth() && td.getDate()===d.getDate();
        });
        pins.forEach(p=>{ const pEl = document.createElement('div'); pEl.className='task-pin'; pEl.innerHTML = `<strong>${escapeHtml(p.title)}</strong><div class="small">${p.tag||'General'} · ${p.hours||0}h</div>`; col.appendChild(pEl); });
        timelineGrid.appendChild(col);
      });
    }

    function scheduleReminderFor(t){
      if(!t.due) return;
      if(!('Notification' in window)) return;
      try{
        const when = new Date(t.due).getTime() - Date.now() - (5*60*1000); // 5 minutes before
        if(when>0 && remindersEnabled){ setTimeout(()=>{ showReminder(t); }, when); }
      }catch(e){}
    }
    function showReminder(t){
      if(Notification.permission==='granted'){
        new Notification('Study Reminder', {body:`${t.title} · due ${formatDate(t.due)}`, silent:false});
      } else { alert(`Reminder: ${t.title} — due ${formatDate(t.due)}`); }
    }

    function scheduleAll(){ tasks.forEach(t=>scheduleReminderFor(t)); }

    // utility
    function formatDate(d){ const dt = new Date(d); return dt.toLocaleString(); }
    function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    // events
    searchInput.addEventListener('input', ()=>render());
    clearSearch.addEventListener('click', ()=>{ searchInput.value=''; render(); });
    sortSelect.addEventListener('change', ()=>{ localStorage.setItem('ss_sort', sortSelect.value); render(); });

    listViewBtn.addEventListener('click', ()=>{ localStorage.setItem('ss_view','list'); cards.style.display='block'; timeline.style.display='none'; });
    cardViewBtn.addEventListener('click', ()=>{ localStorage.setItem('ss_view','cards'); cards.style.display='grid'; timeline.style.display='none'; });
    timelineViewBtn.addEventListener('click', ()=>{ localStorage.setItem('ss_view','timeline'); cards.style.display='none'; timeline.style.display='block'; });

    // notification toggle
    notifyToggle.addEventListener('click', async ()=>{
      if(!('Notification' in window)){ alert('Browser does not support notifications'); return; }
      if(Notification.permission==='granted'){ remindersEnabled = true; notifyToggle.textContent='Reminders: On'; scheduleAll(); }
      else{
        const perm = await Notification.requestPermission(); if(perm==='granted'){ remindersEnabled = true; notifyToggle.textContent='Reminders: On'; scheduleAll(); } else { remindersEnabled=false; notifyToggle.textContent='Enable Reminders'; }
      }
    });

    // load
    (function init(){ sortSelect.value = localStorage.getItem('ss_sort')||'dateAsc'; const v = localStorage.getItem('ss_view')||'cards'; if(v==='timeline'){ cards.style.display='none'; timeline.style.display='block'; }
      render(); // schedule pending
      // schedule reminders for existing tasks only if permission already granted
      if(Notification.permission==='granted'){ remindersEnabled=true; notifyToggle.textContent='Reminders: On'; scheduleAll(); }
    })();

    // small helper: autosave progress when page visibility changed
    window.addEventListener('beforeunload', ()=>saveAll());
