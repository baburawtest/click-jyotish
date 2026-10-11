interface Env {
  ASSETS: Fetcher;
  LEADS_DB?: D1Database;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  LEAD_WEBHOOK_URL?: string;
}

type LeadInput = {
  name?: string;
  phone?: string;
  email?: string;
  dob?: string;
  tob?: string;
  pob?: string;
  service?: string;
  language?: string;
  preferredSlot?: string;
  question?: string;
  source?: string;
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);

function isAdmin(request: Request, env: Env) {
  const expectedUser = env.ADMIN_USERNAME;
  const expectedPassword = env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPassword) return false;
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Basic ')) return false;
  try {
    const [username, password] = atob(header.slice(6)).split(':');
    return username === expectedUser && password === expectedPassword;
  } catch {
    return false;
  }
}

function requireAdmin(request: Request, env: Env) {
  if (isAdmin(request, env)) return null;
  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Click Jyotish Lead Inbox"', 'Cache-Control': 'no-store' }
  });
}

function setupRequired() {
  return json({ error: 'Lead inbox is being set up. Please use WhatsApp to contact Deepak Ji.' }, 503);
}

function dashboardHtml() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Click Jyotish · Lead Inbox</title><style>
*{box-sizing:border-box}body{margin:0;background:#f6f3ec;color:#18213d;font:15px system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:1280px;margin:0 auto;padding:32px 20px}h1{margin:0;font-size:28px}p{color:#566276}.head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:20px}.badge{background:#18213d;color:#fff;border-radius:99px;padding:8px 12px;font-weight:700;font-size:13px}button,select{font:inherit;border:1px solid #d6cfc1;border-radius:7px;padding:8px 10px;background:white;color:#18213d}button{cursor:pointer;background:#b77a27;color:#fff;border:0;font-weight:700}button:hover{background:#8d5e1e}.card{background:#fff;border:1px solid #e5dfd3;border-radius:12px;overflow:auto;box-shadow:0 6px 25px #3828090b}table{width:100%;border-collapse:collapse;min-width:1080px}th,td{text-align:left;padding:13px;border-bottom:1px solid #eee8df;vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#746c61;background:#fbfaf7}.name{font-weight:800}.muted{color:#687385;font-size:13px}.reply{display:inline-block;margin-top:8px;color:#fff;background:#1eaa59;border-radius:5px;padding:6px 8px;text-decoration:none;font-size:12px;font-weight:800}.reply:hover{background:#158043}.question{max-width:280px;white-space:pre-wrap}.empty{text-align:center;padding:42px;color:#687385}@media(max-width:680px){.head{display:block}.badge{display:inline-block;margin-top:10px}}
</style></head><body><main class="wrap"><div class="head"><div><h1>Click Jyotish Lead Inbox</h1><p>Private consultation requests from clickjyotish.in</p></div><div><span class="badge" id="count">Loading…</span> <button id="refresh">Refresh</button></div></div><section class="card"><table><thead><tr><th>Received</th><th>Client</th><th>Consultation</th><th>Birth details</th><th>Question</th><th>Source</th><th>Status</th></tr></thead><tbody id="leads"><tr><td colspan="7" class="empty">Loading leads…</td></tr></tbody></table></section></main><script>
const body=document.querySelector('#leads'),count=document.querySelector('#count');
const esc=v=>String(v??'');
const format=v=>v?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
async function setStatus(id,status){await fetch('/api/leads/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});load()}
function leadRow(l){const tr=document.createElement('tr');const cells=[format(l.created_at),null,l.service+' · '+l.language+'\\n'+(l.preferred_slot||'No preferred slot'),(l.dob||'—')+' · '+(l.tob||'Time not given')+'\\n'+(l.pob||''),l.question||'—',l.source||'Direct',null];cells.forEach((value,i)=>{const td=document.createElement('td');if(i===1){td.innerHTML='<div class="name"></div><div class="muted"></div><div class="muted"></div>';td.children[0].textContent=l.name;td.children[1].textContent=l.phone;td.children[2].textContent=l.email;const number=String(l.phone||'').replace(/\\D/g,'');const waNumber=number.length===10?'91'+number:number;if(waNumber){const reply=document.createElement('a');reply.className='reply';reply.target='_blank';reply.rel='noreferrer';reply.href='https://wa.me/'+waNumber+'?text='+encodeURIComponent('Namaste '+(l.name||'Ji')+', thank you for your consultation request with Click Jyotish. This is Deepak Ji. I have received your request for '+(l.service||'a consultation')+'. Please let me know a suitable time to speak.');reply.textContent='Reply on WhatsApp';td.append(reply)}}else if(i===6){const select=document.createElement('select');['new','contacted','booked','closed'].forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s[0].toUpperCase()+s.slice(1);o.selected=s===l.status;select.append(o)});select.onchange=()=>setStatus(l.id,select.value);td.append(select)}else{td.textContent=value;td.className=i===4?'question':''}tr.append(td)});return tr}
async function load(){body.innerHTML='<tr><td colspan="7" class="empty">Loading leads…</td></tr>';try{const r=await fetch('/api/leads');if(!r.ok)throw Error();const data=await r.json();body.innerHTML='';count.textContent=data.total+' total leads';if(!data.leads.length){body.innerHTML='<tr><td colspan="7" class="empty">No leads yet. New requests will appear here.</td></tr>';return}data.leads.forEach(l=>body.append(leadRow(l)))}catch{body.innerHTML='<tr><td colspan="7" class="empty">Could not load leads. Refresh the page and sign in again if asked.</td></tr>';count.textContent='Unable to load'}}
document.querySelector('#refresh').onclick=load;load();
</script></body></html>`;
}

async function submitLead(request: Request, env: Env, ctx: ExecutionContext) {
  if (!env.LEADS_DB) return setupRequired();
  let input: LeadInput;
  try { input = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const lead = {
    name: clean(input.name, 100), phone: clean(input.phone, 40), email: clean(input.email, 160),
    dob: clean(input.dob, 20), tob: clean(input.tob, 60), pob: clean(input.pob, 160),
    service: clean(input.service, 180), language: clean(input.language, 40),
    preferredSlot: clean(input.preferredSlot, 100), question: clean(input.question, 2000),
    source: clean(input.source, 80) || 'Click Jyotish Website'
  };
  if (!lead.name || !lead.phone || !lead.email || !lead.dob || !lead.pob || !lead.service) {
    return json({ error: 'Please complete all required details.' }, 400);
  }
  if (!/^\S+@\S+\.\S+$/.test(lead.email)) return json({ error: 'Enter a valid email address.' }, 400);
  const result = await env.LEADS_DB.prepare(`INSERT INTO leads (name, phone, email, dob, tob, pob, service, language, preferred_slot, question, source, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`).bind(lead.name, lead.phone, lead.email, lead.dob, lead.tob, lead.pob, lead.service, lead.language, lead.preferredSlot, lead.question, lead.source).run();
  const id = Number(result.meta.last_row_id);
  if (env.LEAD_WEBHOOK_URL) {
    ctx.waitUntil(fetch(env.LEAD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...lead, status: 'new', createdAt: new Date().toISOString() }) }).catch(() => undefined));
  }
  return json({ ok: true, id }, 201);
}

async function listLeads(request: Request, env: Env) {
  if (!env.LEADS_DB) return setupRequired();
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 200);
  const leads = await env.LEADS_DB.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT ?').bind(limit).all();
  const count = await env.LEADS_DB.prepare('SELECT COUNT(*) AS total FROM leads').first<{ total: number }>();
  return json({ leads: leads.results, total: count?.total ?? 0 });
}

async function updateLead(request: Request, env: Env, id: number) {
  if (!env.LEADS_DB) return setupRequired();
  let status = '';
  try { status = clean((await request.json()).status, 20); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (!['new', 'contacted', 'booked', 'closed'].includes(status)) return json({ error: 'Invalid lead status.' }, 400);
  await env.LEADS_DB.prepare("UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(status, id).run();
  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/leads' && request.method === 'POST') return submitLead(request, env, ctx);
    if (url.pathname === '/api/leads' && request.method === 'GET') {
      const denied = requireAdmin(request, env); return denied ?? listLeads(request, env);
    }
    const match = url.pathname.match(/^\/api\/leads\/(\d+)$/);
    if (match && request.method === 'PATCH') {
      const denied = requireAdmin(request, env); return denied ?? updateLead(request, env, Number(match[1]));
    }
    if (url.pathname === '/admin/leads') {
      const denied = requireAdmin(request, env); return denied ?? new Response(dashboardHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    return env.ASSETS.fetch(request);
  }
};
