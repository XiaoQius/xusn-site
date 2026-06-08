(function(){
  const STORAGE_KEY='xusn_site_data_v2';
  const AUTH_KEY='xusn_admin_auth_v1';
  const TOKEN_KEY='t';
  const DEFAULT_DATA={
    config:{
      name:'绪深',title:'高一学生',subtitle:'热爱编程 · 开源爱好者 · 终身学习者',
      desc:'我是绪深，目前是一名高一学生。虽然课业繁忙，但我总能挤出时间沉浸在代码的世界里。',
      avatar:'https://q1.qlogo.cn/g?b=qq&nk=2687821674&s=640',email:'un@xusn.dev',github:'https://github.com/XiaoQius',website:'https://xusn.cn',
      footer:'用温柔的方式改变世界 💛',location:'中国',education:'高一',theme:'warm'
    },
    skills:[
      {id:1,name:'Python',category:'语言',level:85},{id:2,name:'JavaScript',category:'语言',level:75},{id:3,name:'HTML/CSS',category:'语言',level:90},
      {id:4,name:'React',category:'前端',level:70},{id:5,name:'Vue.js',category:'前端',level:65},{id:6,name:'Tailwind',category:'前端',level:80},
      {id:7,name:'Git',category:'工具',level:75},{id:8,name:'VS Code',category:'工具',level:95},{id:9,name:'Docker',category:'工具',level:40}
    ],
    projects:[
      {id:1,title:'个人主页系统',desc:'响应式个人网站，采用现代 CSS 技术',color:'#FF6B6B',icon:'fas fa-globe',tags:['Web','设计'],link:'https://github.com/XiaoQius/XUSN-PAGE',thumbnail:'',sort:1},
      {id:2,title:'学习助手 Bot',desc:'管理学习计划的 Telegram Bot，支持任务追踪',color:'#4ECDC4',icon:'fas fa-robot',tags:['Python','自动化'],link:'#',thumbnail:'',sort:2},
      {id:3,title:'专注时钟',desc:'基于番茄工作法的专注工具，带白噪音和统计',color:'#FFE66D',icon:'fas fa-mobile-alt',tags:['App','PWA'],link:'#',thumbnail:'',sort:3}
    ],
    visitors:[],vitals:[],locations:[]
  };

  function clone(v){return JSON.parse(JSON.stringify(v))}
  function load(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(saved) return Object.assign(clone(DEFAULT_DATA),saved,{config:Object.assign({},DEFAULT_DATA.config,saved.config||{})});
    }catch{}
    return clone(DEFAULT_DATA);
  }
  function save(data){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return data}
  function auth(){
    try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')||{username:'admin',password:'admin123'}}catch{return {username:'admin',password:'admin123'}}
  }
  function saveAuth(next){localStorage.setItem(AUTH_KEY,JSON.stringify(next));return next}
  function tokenFor(username){return btoa(unescape(encodeURIComponent(username+'|'+Date.now())))}
  function ok(body,status=200){return Promise.resolve(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}}))}
  async function readBody(init){try{return JSON.parse(init&&init.body?init.body:'{}')}catch{return {}}}
  function nextId(items){return items.reduce((m,i)=>Math.max(m,Number(i.id)||0),0)+1}
  function browserName(ua){return /Edg/i.test(ua)?'Edge':/Chrome/i.test(ua)?'Chrome':/Firefox/i.test(ua)?'Firefox':/Safari/i.test(ua)?'Safari':'Other'}
  function stats(data){
    const now=new Date();
    const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime()/1000;
    const recent=[...data.visitors].sort((a,b)=>b.created_at-a.created_at).slice(0,20);
    const total=data.visitors.length;
    const group=(items,keyFn)=>Object.entries(items.reduce((a,x)=>{const k=keyFn(x);a[k]=(a[k]||0)+1;return a},{}));
    const browsers=group(data.visitors,v=>browserName(v.ua)).map(([browser,c])=>({browser,c})).sort((a,b)=>b.c-a.c).slice(0,5);
    const pages=group(data.visitors,v=>v.page||'/').map(([page,c])=>({page,c})).sort((a,b)=>b.c-a.c).slice(0,10);
    const days=[];
    for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);const day=d.toISOString().slice(0,10);days.push({day,c:data.visitors.filter(v=>new Date(v.created_at*1000).toISOString().slice(0,10)===day).length})}
    const vitals=group(data.vitals,v=>v.name).map(([name,c])=>{const values=data.vitals.filter(v=>v.name===name).map(v=>Number(v.value)||0);return {name,avg:Math.round(values.reduce((s,v)=>s+v,0)/Math.max(values.length,1)*10)/10,c}}).sort((a,b)=>a.name.localeCompare(b.name));
    return {total,today:data.visitors.filter(v=>v.created_at>=start).length,recent,browsers,pages,trend:days,vitals};
  }
  function githubUsername(url){return String(url||'').replace(/https?:\/\/github\.com\//,'').split('/')[0].split('?')[0]}
  async function githubData(){
    const username=githubUsername(load().config.github);
    if(!username) return {username:'',public_repos:0,followers:0,total_stars:0};
    try{
      const [user,repos]=await Promise.all([
        window.fetch(`https://api.github.com/users/${username}`).then(r=>r.json()),
        window.fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=stars`).then(r=>r.json())
      ]);
      return {username,public_repos:user.public_repos||0,followers:user.followers||0,total_stars:Array.isArray(repos)?repos.reduce((s,r)=>s+(r.stargazers_count||0),0):0,avatar:user.avatar_url||''};
    }catch{return {username,public_repos:0,followers:0,total_stars:0}}
  }

  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    const path=url.startsWith(location.origin)?new URL(url).pathname:url;
    if(!path.startsWith('/api/')) return nativeFetch(input,init);
    const data=load();
    const method=(init.method||'GET').toUpperCase();
    if(path==='/api/site'&&method==='GET') return ok({config:data.config,skills:data.skills,projects:[...data.projects].sort((a,b)=>(b.sort||0)-(a.sort||0)||a.id-b.id)});
    if(path==='/api/github'&&method==='GET') return ok(await githubData());
    if(path==='/api/login'&&method==='POST'){
      const body=await readBody(init),a=auth();
      if(body.username===a.username&&body.password===a.password) return ok({token:tokenFor(a.username)});
      return ok({error:'用户名或密码错误'},401);
    }
    if(path==='/api/admin/config'&&method==='PUT'){Object.assign(data.config,await readBody(init));save(data);return ok({ok:true})}
    if(path==='/api/admin/skills'&&method==='GET') return ok([...data.skills].sort((a,b)=>String(a.category).localeCompare(String(b.category))||a.id-b.id));
    if(path==='/api/admin/skills'&&method==='POST'){const item=Object.assign({id:nextId(data.skills)},await readBody(init));data.skills.push(item);save(data);return ok({id:item.id})}
    let m=path.match(/^\/api\/admin\/skills\/(\d+)$/);
    if(m){const id=Number(m[1]);if(method==='PUT'){const body=await readBody(init);data.skills=data.skills.map(i=>i.id===id?Object.assign(i,body):i);save(data);return ok({ok:true})}if(method==='DELETE'){data.skills=data.skills.filter(i=>i.id!==id);save(data);return ok({ok:true})}}
    if(path==='/api/admin/projects'&&method==='GET') return ok([...data.projects].sort((a,b)=>(b.sort||0)-(a.sort||0)||a.id-b.id));
    if(path==='/api/admin/projects'&&method==='POST'){const item=Object.assign({id:nextId(data.projects),thumbnail:''},await readBody(init));data.projects.push(item);save(data);return ok({id:item.id})}
    m=path.match(/^\/api\/admin\/projects\/(\d+)$/);
    if(m){const id=Number(m[1]);if(method==='PUT'){const body=await readBody(init);data.projects=data.projects.map(i=>i.id===id?Object.assign(i,body):i);save(data);return ok({ok:true})}if(method==='DELETE'){data.projects=data.projects.filter(i=>i.id!==id);save(data);return ok({ok:true})}}
    if(path==='/api/admin/stats'&&method==='GET') return ok(stats(data));
    if(path==='/api/admin/visitors/map'&&method==='GET') return ok({locations:data.locations,total:data.locations.length});
    if(path==='/api/visit'&&method==='POST'){
      const body=await readBody(init),now=Math.floor(Date.now()/1000),ua=navigator.userAgent;
      data.visitors.push({ip:'local',ua,page:body.page||location.pathname,created_at:now});
      data.visitors=data.visitors.slice(-500);save(data);return ok({total:data.visitors.length});
    }
    if(path==='/api/geolocation'&&method==='POST'){const body=await readBody(init);if(typeof body.lat==='number'&&typeof body.lon==='number'){data.locations.push({city:'浏览器定位',country:'Local',lat:body.lat,lon:body.lon});data.locations=data.locations.slice(-50);save(data)}return ok({ok:true})}
    if(path==='/api/vitals'&&method==='POST'){const body=await readBody(init);if(body.name&&typeof body.value==='number'){data.vitals.push({name:body.name,value:body.value,page:body.page||location.pathname,ua:body.ua||navigator.userAgent,created_at:Math.floor(Date.now()/1000)});data.vitals=data.vitals.slice(-500);save(data)}return ok({ok:true})}
    if(path==='/api/admin/password'&&method==='PUT'){
      const body=await readBody(init),a=auth();
      if(body.oldPassword!==a.password) return ok({error:'旧密码错误'},400);
      saveAuth({username:body.username||a.username,password:body.newPassword||a.password});return ok({ok:true});
    }
    return ok({error:'Not found'},404);
  };
  const NativeEventSource=window.EventSource;
  window.EventSource=function(url){
    if(String(url).startsWith('/api/admin/visitors/stream')) return {onmessage:null,onerror:null,close(){}};
    return new NativeEventSource(url);
  };
  window.XUSNSiteData={load,save,reset(){localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(AUTH_KEY);localStorage.removeItem(TOKEN_KEY);location.reload()},defaults:clone(DEFAULT_DATA)};
})();
