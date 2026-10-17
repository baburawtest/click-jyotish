interface Env {
  ASSETS: Fetcher;
  LEADS_DB?: D1Database;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  LEAD_WEBHOOK_URL?: string;
  SHUBH_API_KEY?: string;
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

function removedLegacyShopResponse() {
  return new Response('This legacy shop page has been permanently removed.', {
    status: 410,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'X-Robots-Tag': 'noindex'
    }
  });
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

function getIstDateParts() {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const get = (type: string) => values.find((part) => part.type === type)?.value ?? '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  return { year: Number(year), month: Number(month), day: Number(day), iso: `${year}-${month}-${day}` };
}

function unwrap(value: unknown): UnknownRecord {
  if (!isRecord(value)) return {};
  if (isRecord(value.output)) return value.output;
  if (isRecord(value.data)) return value.data;
  return value;
}

function formatIstTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true
  }).format(parsed);
}

function periodText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return null;
  const start = formatIstTime(value.start ?? value.startAt ?? value.startsAt ?? value.startTime ?? value.start_time ?? value.start_at ?? value.from);
  const end = formatIstTime(value.end ?? value.endsAt ?? value.ends_at ?? value.endTime ?? value.end_time ?? value.end_at ?? value.to);
  if (start && end) return `${start} – ${end}`;
  return formatIstTime(value.time ?? value.value);
}

function findPeriod(value: unknown, aliases: string[]): string | null {
  const names = aliases.map((alias) => alias.replace(/[^a-z]/gi, '').toLowerCase());
  const visit = (entry: unknown, depth = 0): string | null => {
    if (depth > 7 || !entry) return null;
    if (Array.isArray(entry)) {
      for (const item of entry) { const found = visit(item, depth + 1); if (found) return found; }
      return null;
    }
    if (!isRecord(entry)) return null;
    const label = [entry.name, entry.label, entry.title, entry.type, entry.period]
      .filter((item): item is string => typeof item === 'string')
      .join(' ').replace(/[^a-z]/gi, '').toLowerCase();
    if (names.some((name) => label.includes(name))) {
      const text = periodText(entry);
      if (text) return text;
    }
    for (const [key, child] of Object.entries(entry)) {
      const normalised = key.replace(/[^a-z]/gi, '').toLowerCase();
      if (names.some((name) => normalised.includes(name))) {
        const text = periodText(child);
        if (text) return text;
      }
    }
    for (const child of Object.values(entry)) { const found = visit(child, depth + 1); if (found) return found; }
    return null;
  };
  return visit(value);
}

function festivalNames(value: unknown, date: string): string[] {
  const found = new Set<string>();
  const visit = (entry: unknown, depth = 0) => {
    if (depth > 8 || !entry) return;
    if (Array.isArray(entry)) { entry.forEach((item) => visit(item, depth + 1)); return; }
    if (!isRecord(entry)) return;
    const dates = [entry.date, entry.observanceDate, entry.observance_date, entry.startDate].filter((item): item is string => typeof item === 'string');
    if (dates.some((item) => item.slice(0, 10) === date)) {
      const name = [entry.name, entry.festival, entry.title, entry.label].find((item): item is string => typeof item === 'string' && item.trim().length > 0);
      if (name) found.add(name.trim());
    }
    Object.values(entry).forEach((child) => visit(child, depth + 1));
  };
  visit(value);
  return [...found].slice(0, 3);
}

function tithiObservance(tithi: UnknownRecord) {
  const number = Number(tithi.number);
  const paksha = typeof tithi.paksha === 'string' ? tithi.paksha : '';
  if (number === 11) return `${paksha ? `${paksha} ` : ''}Ekadashi`;
  if (number === 15 && /shukla/i.test(paksha)) return 'Purnima';
  if (number === 15 && /krishna/i.test(paksha)) return 'Amavasya';
  return null;
}

async function fetchShubh(path: string, params: URLSearchParams, apiKey: string) {
  const response = await fetch(`https://shubh.live/api/v1/${path}?${params.toString()}`, {
    headers: { 'X-API-Key': apiKey, Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Panchang provider returned ${response.status}`);
  return response.json();
}

async function dailyPanchang(env: Env) {
  if (!env.SHUBH_API_KEY) return json({ error: 'Daily Panchang is being configured. Please check back shortly.' }, 503);
  const { year, month, day, iso } = getIstDateParts();
  const cacheKey = new Request(`https://clickjyotish.in/api/panchang-cache?date=${iso}&city=new-delhi`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const location = new URLSearchParams({ lat: '28.6139', lon: '77.2090', date: iso });
  const festivals = new URLSearchParams({ lat: '28.6139', lon: '77.2090', year: String(year) });
  try {
    const [rawPanchang, rawPeriods, rawFestivals] = await Promise.all([
      fetchShubh('panchang', location, env.SHUBH_API_KEY),
      fetchShubh('day-periods', location, env.SHUBH_API_KEY),
      fetchShubh('panchang/festivals', festivals, env.SHUBH_API_KEY)
    ]);
    const panchang = unwrap(rawPanchang);
    const tithi = isRecord(panchang.tithi) ? panchang.tithi : {};
    const nakshatra = isRecord(panchang.nakshatra) ? panchang.nakshatra : {};
    const listedFestivals = festivalNames(rawFestivals, iso);
    const observance = listedFestivals.length ? listedFestivals : [tithiObservance(tithi) ?? 'No major festival listed for New Delhi today'];
    const response = json({
      date: iso,
      location: 'New Delhi, India (IST)',
      tithi: { name: tithi.name ?? '—', paksha: tithi.paksha ?? '', endsAt: formatIstTime(tithi.endsAt ?? tithi.end) },
      nakshatra: { name: nakshatra.name ?? '—', endsAt: formatIstTime(nakshatra.endsAt ?? nakshatra.end) },
      rahuKaal: findPeriod(rawPeriods, ['rahu kaal', 'rahu kalam', 'rahu']),
      abhijitMuhurat: findPeriod(rawPeriods, ['abhijit muhurat', 'abhijit']),
      sunrise: formatIstTime(panchang.sunrise),
      sunset: formatIstTime(panchang.sunset),
      festivals: observance,
      source: 'ShubhAI Panchang'
    }, 200);
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=21600');
    await caches.default.put(cacheKey, response.clone());
    return response;
  } catch {
    return json({ error: 'Today’s Panchang is temporarily unavailable. Please refresh shortly.' }, 502);
  }
}

function dashboardHtml() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Click Jyotish · Lead Inbox</title><style>
*{box-sizing:border-box}body{margin:0;background:#f6f3ec;color:#18213d;font:15px system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:1280px;margin:0 auto;padding:32px 20px}h1{margin:0;font-size:28px}p{color:#566276}.head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:20px}.badge{background:#18213d;color:#fff;border-radius:99px;padding:8px 12px;font-weight:700;font-size:13px}button,select,input{font:inherit;border:1px solid #d6cfc1;border-radius:7px;padding:8px 10px;background:white;color:#18213d}button{cursor:pointer;background:#b77a27;color:#fff;border:0;font-weight:700}button:hover{background:#8d5e1e}.tools{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}.tools input{min-width:240px;flex:1}.tools .download{background:#18213d}.tools .download:hover{background:#303c61}.card{background:#fff;border:1px solid #e5dfd3;border-radius:12px;overflow:auto;box-shadow:0 6px 25px #3828090b}table{width:100%;border-collapse:collapse;min-width:1080px}th,td{text-align:left;padding:13px;border-bottom:1px solid #eee8df;vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#746c61;background:#fbfaf7}.name{font-weight:800}.muted{color:#687385;font-size:13px}.reply{display:inline-block;margin-top:8px;color:#fff;background:#1eaa59;border-radius:5px;padding:6px 8px;text-decoration:none;font-size:12px;font-weight:800}.reply:hover{background:#158043}.question{max-width:280px;white-space:pre-wrap}.empty{text-align:center;padding:42px;color:#687385}@media(max-width:680px){.head{display:block}.badge{display:inline-block;margin-top:10px}.tools input{min-width:100%}}
</style></head><body><main class="wrap"><div class="head"><div><h1>Click Jyotish Lead Inbox</h1><p>Private consultation requests from clickjyotish.in</p></div><div><span class="badge" id="count">Loading…</span> <button id="refresh">Refresh</button></div></div><div class="tools"><input id="search" type="search" placeholder="Search name, phone, email or question"><select id="statusFilter"><option value="">All statuses</option><option value="new">New</option><option value="contacted">Contacted</option><option value="booked">Booked</option><option value="closed">Closed</option></select><select id="sourceFilter"><option value="">All sources</option></select><button class="download" id="download">Download CSV</button></div><section class="card"><table><thead><tr><th>Received</th><th>Client</th><th>Consultation</th><th>Birth details</th><th>Question</th><th>Source</th><th>Status</th></tr></thead><tbody id="leads"><tr><td colspan="7" class="empty">Loading leads…</td></tr></tbody></table></section></main><script>
const body=document.querySelector('#leads'),count=document.querySelector('#count'),search=document.querySelector('#search'),statusFilter=document.querySelector('#statusFilter'),sourceFilter=document.querySelector('#sourceFilter');let leads=[];
const esc=v=>String(v??'');
const format=v=>v?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
async function setStatus(id,status){await fetch('/api/leads/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});load()}
function leadRow(l){const tr=document.createElement('tr');const cells=[format(l.created_at),null,l.service+' · '+l.language+'\\n'+(l.preferred_slot||'No preferred slot'),(l.dob||'—')+' · '+(l.tob||'Time not given')+'\\n'+(l.pob||''),l.question||'—',l.source||'Direct',null];cells.forEach((value,i)=>{const td=document.createElement('td');if(i===1){td.innerHTML='<div class="name"></div><div class="muted"></div><div class="muted"></div>';td.children[0].textContent=l.name;td.children[1].textContent=l.phone;td.children[2].textContent=l.email;const number=String(l.phone||'').replace(/\\D/g,'');const waNumber=number.length===10?'91'+number:number;if(waNumber){const reply=document.createElement('a');reply.className='reply';reply.target='_blank';reply.rel='noreferrer';reply.href='https://wa.me/'+waNumber+'?text='+encodeURIComponent('Namaste '+(l.name||'there')+', thank you for your consultation request with Click Jyotish. This is Deepak. I have received your request for '+(l.service||'a consultation')+'. Please let me know a suitable time to speak.');reply.textContent='Reply on WhatsApp';td.append(reply)}}else if(i===6){const select=document.createElement('select');['new','contacted','booked','closed'].forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s[0].toUpperCase()+s.slice(1);o.selected=s===l.status;select.append(o)});select.onchange=()=>setStatus(l.id,select.value);td.append(select)}else{td.textContent=value;td.className=i===4?'question':''}tr.append(td)});return tr}
function render(){const q=search.value.trim().toLowerCase(),status=statusFilter.value,source=sourceFilter.value;const shown=leads.filter(l=>{const haystack=[l.name,l.phone,l.email,l.service,l.question,l.source].join(' ').toLowerCase();return(!q||haystack.includes(q))&&(!status||l.status===status)&&(!source||(l.source||'Direct')===source)});body.innerHTML='';count.textContent=shown.length+' of '+leads.length+' leads';if(!shown.length){body.innerHTML='<tr><td colspan="7" class="empty">No leads match these filters.</td></tr>';return}shown.forEach(l=>body.append(leadRow(l)))}
function updateSources(){const selected=sourceFilter.value;const sources=[...new Set(leads.map(l=>l.source||'Direct'))].sort();sourceFilter.innerHTML='<option value="">All sources</option>';sources.forEach(source=>{const option=document.createElement('option');option.value=source;option.textContent=source;if(source===selected)option.selected=true;sourceFilter.append(option)})}
function csv(value){const text=String(value??'');return '"'+text.replace(/"/g,'""')+'"'}
function downloadCsv(){const columns=['Received at','Name','Phone','Email','Service','Language','Date of birth','Time of birth','Place of birth','Preferred slot','Question','Source','Status'];const rows=leads.map(l=>[l.created_at,l.name,l.phone,l.email,l.service,l.language,l.dob,l.tob,l.pob,l.preferred_slot,l.question,l.source||'Direct',l.status]);const file=[columns,...rows].map(row=>row.map(csv).join(',')).join('\\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([file],{type:'text/csv;charset=utf-8'}));link.download='click-jyotish-leads.csv';link.click();URL.revokeObjectURL(link.href)}
async function load(){body.innerHTML='<tr><td colspan="7" class="empty">Loading leads…</td></tr>';try{const r=await fetch('/api/leads');if(!r.ok)throw Error();const data=await r.json();leads=data.leads;updateSources();if(!leads.length){body.innerHTML='<tr><td colspan="7" class="empty">No leads yet. New requests will appear here.</td></tr>';count.textContent='0 leads';return}render()}catch{body.innerHTML='<tr><td colspan="7" class="empty">Could not load leads. Refresh the page and sign in again if asked.</td></tr>';count.textContent='Unable to load'}}
document.querySelector('#refresh').onclick=load;document.querySelector('#download').onclick=downloadCsv;search.oninput=render;statusFilter.onchange=render;sourceFilter.onchange=render;load();
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
  const needsBirthDetails = !/Vastu|Palmistry/i.test(lead.service);
  const needsServiceQuestion = /Vastu|Palmistry/i.test(lead.service);
  if (!lead.name || !lead.phone || !lead.email || !lead.service || (needsBirthDetails && (!lead.dob || !lead.pob)) || (needsServiceQuestion && !lead.question)) {
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
    // These paths belonged to the former WooCommerce furniture store, not Click Jyotish.
    // A 410 helps search engines retire their many old filtered-product URLs without
    // misleading visitors by redirecting them to the astrology homepage.
    if (/^\/(shop|product|product-category|cart|checkout|my-account)(?:\/|$)/.test(url.pathname)) {
      return removedLegacyShopResponse();
    }
    if (url.pathname === '/api/panchang' && request.method === 'GET') return dailyPanchang(env);
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
