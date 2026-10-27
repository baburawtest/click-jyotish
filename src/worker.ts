interface Env {
  ASSETS: Fetcher;
  LEADS_DB?: D1Database;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  LEAD_WEBHOOK_URL?: string;
  SHUBH_API_KEY?: string;
  GEMINI_API_KEY?: string;
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
  return json({ error: 'Lead inbox is being set up. Please use WhatsApp to contact Deepak.' }, 503);
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

type PalmReflectionInput = {
  image?: unknown;
  mimeType?: unknown;
  language?: unknown;
  consent?: unknown;
};

const palmRequestWindows = new Map<string, { count: number; resetAt: number }>();
const palmAllowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const palmMaxBase64Length = 4_000_000;

type PanchangCity = { id: string; name: string; latitude: string; longitude: string };

const panchangCities: PanchangCity[] = [
  // North India
  { id: 'delhi', name: 'New Delhi', latitude: '28.6139', longitude: '77.2090' },
  { id: 'gurugram', name: 'Gurugram', latitude: '28.4595', longitude: '77.0266' },
  { id: 'noida', name: 'Noida', latitude: '28.5355', longitude: '77.3910' },
  { id: 'ghaziabad', name: 'Ghaziabad', latitude: '28.6692', longitude: '77.4538' },
  { id: 'chandigarh', name: 'Chandigarh', latitude: '30.7333', longitude: '76.7794' },
  { id: 'jaipur', name: 'Jaipur', latitude: '26.9124', longitude: '75.7873' },
  { id: 'lucknow', name: 'Lucknow', latitude: '26.8467', longitude: '80.9462' },
  { id: 'varanasi', name: 'Varanasi', latitude: '25.3176', longitude: '82.9739' },
  { id: 'dehradun', name: 'Dehradun', latitude: '30.3165', longitude: '78.0322' },
  // West and Central India
  { id: 'mumbai', name: 'Mumbai', latitude: '19.0760', longitude: '72.8777' },
  { id: 'pune', name: 'Pune', latitude: '18.5204', longitude: '73.8567' },
  { id: 'nagpur', name: 'Nagpur', latitude: '21.1458', longitude: '79.0882' },
  { id: 'ahmedabad', name: 'Ahmedabad', latitude: '23.0225', longitude: '72.5714' },
  { id: 'surat', name: 'Surat', latitude: '21.1702', longitude: '72.8311' },
  { id: 'indore', name: 'Indore', latitude: '22.7196', longitude: '75.8577' },
  { id: 'bhopal', name: 'Bhopal', latitude: '23.2599', longitude: '77.4126' },
  // South India
  { id: 'bengaluru', name: 'Bengaluru', latitude: '12.9716', longitude: '77.5946' },
  { id: 'chennai', name: 'Chennai', latitude: '13.0827', longitude: '80.2707' },
  { id: 'hyderabad', name: 'Hyderabad', latitude: '17.3850', longitude: '78.4867' },
  { id: 'kochi', name: 'Kochi', latitude: '9.9312', longitude: '76.2673' },
  { id: 'thiruvananthapuram', name: 'Thiruvananthapuram', latitude: '8.5241', longitude: '76.9366' },
  // East and North-East India
  { id: 'kolkata', name: 'Kolkata', latitude: '22.5726', longitude: '88.3639' },
  { id: 'bhubaneswar', name: 'Bhubaneswar', latitude: '20.2961', longitude: '85.8245' },
  { id: 'patna', name: 'Patna', latitude: '25.5941', longitude: '85.1376' },
  { id: 'ranchi', name: 'Ranchi', latitude: '23.3441', longitude: '85.3096' },
  { id: 'guwahati', name: 'Guwahati', latitude: '26.1445', longitude: '91.7362' }
];

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
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true
  }).format(parsed);
}

function standardDayPeriods(sunrise: unknown, sunset: unknown, date: string) {
  if (typeof sunrise !== 'string' || typeof sunset !== 'string') return { rahuKaal: null, abhijitMuhurat: null };
  const rise = new Date(sunrise);
  const set = new Date(sunset);
  const daylight = set.getTime() - rise.getTime();
  if (Number.isNaN(rise.getTime()) || Number.isNaN(set.getTime()) || daylight <= 0) return { rahuKaal: null, abhijitMuhurat: null };
  // Sunday through Saturday. Rahu Kaal divides local daylight into eight equal portions.
  const rahuSegment = [7, 1, 6, 4, 5, 3, 2][new Date(`${date}T12:00:00+05:30`).getUTCDay()];
  const eighth = daylight / 8;
  const fifteenth = daylight / 15;
  const range = (from: number, to: number) => `${formatIstTime(new Date(rise.getTime() + from))} – ${formatIstTime(new Date(rise.getTime() + to))}`;
  return {
    rahuKaal: range(rahuSegment * eighth, (rahuSegment + 1) * eighth),
    abhijitMuhurat: range(7 * fifteenth, 8 * fifteenth)
  };
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

async function dailyPanchang(env: Env, cityId: string | null) {
  if (!env.SHUBH_API_KEY) return json({ error: 'Daily Panchang is being configured. Please check back shortly.' }, 503);
  const city = panchangCities.find((candidate) => candidate.id === cityId) ?? panchangCities[0];
  const { year, iso } = getIstDateParts();
  // Bump this version whenever the normalisation code changes so Cloudflare does
  // not serve an older, incomplete daily result after a Worker deployment.
  const cacheKey = new Request(`https://clickjyotish.in/api/panchang-cache-v4?date=${iso}&city=${city.id}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const location = new URLSearchParams({ lat: city.latitude, lon: city.longitude, date: iso });
  const festivals = new URLSearchParams({ lat: city.latitude, lon: city.longitude, year: String(year) });
  try {
    const [rawPanchang, rawPeriods, rawFestivals] = await Promise.all([
      fetchShubh('panchang', location, env.SHUBH_API_KEY),
      fetchShubh('day-periods', location, env.SHUBH_API_KEY),
      fetchShubh('panchang/festivals', festivals, env.SHUBH_API_KEY)
    ]);
    const panchang = unwrap(rawPanchang);
    const tithi = isRecord(panchang.tithi) ? panchang.tithi : {};
    const nakshatra = isRecord(panchang.nakshatra) ? panchang.nakshatra : {};
    const fallbackTimings = standardDayPeriods(panchang.sunrise, panchang.sunset, iso);
    const listedFestivals = festivalNames(rawFestivals, iso);
    const observance = listedFestivals.length ? listedFestivals : [tithiObservance(tithi) ?? `No major festival listed for ${city.name} today`];
    const providerRahuKaal = findPeriod(rawPeriods, ['rahu kaal', 'rahu kalam', 'rahu']);
    const providerAbhijit = findPeriod(rawPeriods, ['abhijit muhurat', 'abhijit']);
    const rahuKaal = providerRahuKaal ?? fallbackTimings.rahuKaal;
    const abhijitMuhurat = providerAbhijit ?? fallbackTimings.abhijitMuhurat;
    const response = json({
      date: iso,
      location: `${city.name}, India (IST)`,
      tithi: { name: tithi.name ?? '—', paksha: tithi.paksha ?? '', endsAt: formatIstTime(tithi.endsAt ?? tithi.end) },
      nakshatra: { name: nakshatra.name ?? '—', endsAt: formatIstTime(nakshatra.endsAt ?? nakshatra.end) },
      rahuKaal,
      abhijitMuhurat,
      timings: {
        rahuKaal: { value: rahuKaal, basis: providerRahuKaal ? 'provider' : rahuKaal ? 'calculated' : 'unavailable' },
        abhijitMuhurat: { value: abhijitMuhurat, basis: providerAbhijit ? 'provider' : abhijitMuhurat ? 'calculated' : 'unavailable' }
      },
      sunrise: formatIstTime(panchang.sunrise),
      sunset: formatIstTime(panchang.sunset),
      festivals: observance,
      source: 'ShubhAI Panchang',
      generatedAt: new Date().toISOString()
    }, 200);
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=21600');
    await caches.default.put(cacheKey, response.clone());
    return response;
  } catch {
    return json({ error: 'Today’s Panchang is temporarily unavailable. Please refresh shortly.' }, 502);
  }
}

function palmRateLimit(request: Request) {
  const client = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const current = palmRequestWindows.get(client);
  if (!current || current.resetAt <= now) {
    palmRequestWindows.set(client, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return null;
  }
  if (current.count >= 2) return Math.ceil((current.resetAt - now) / 60_000);
  current.count += 1;
  return null;
}

function isPalmImage(value: unknown, mimeType: unknown) {
  return typeof value === 'string' && value.length > 100 && value.length <= palmMaxBase64Length && /^[A-Za-z0-9+/]+={0,2}$/.test(value) && typeof mimeType === 'string' && palmAllowedMimeTypes.has(mimeType);
}

function textFromGeminiContent(value: unknown) {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (isRecord(item) && typeof item.text === 'string' && item.text.trim()) return item.text.trim();
  }
  return null;
}

function geminiText(value: unknown) {
  if (!isRecord(value)) return null;
  if (typeof value.output_text === 'string' && value.output_text.trim()) return value.output_text.trim();
  const directOutput = textFromGeminiContent(value.output);
  if (directOutput) return directOutput;
  if (Array.isArray(value.steps)) {
    for (const step of value.steps) {
      if (!isRecord(step)) continue;
      const stepOutput = textFromGeminiContent(step.content);
      if (stepOutput) return stepOutput;
    }
  }
  if (Array.isArray(value.candidates)) {
    for (const candidate of value.candidates) {
      if (!isRecord(candidate) || !isRecord(candidate.content)) continue;
      const candidateOutput = textFromGeminiContent(candidate.content.parts);
      if (candidateOutput) return candidateOutput;
    }
  }
  return null;
}

type PalmReflectionSections = {
  summary: string;
  patterns: string;
  reflection: string;
};

function palmSections(reading: string, language: 'English' | 'Hindi'): PalmReflectionSections {
  const fallback: PalmReflectionSections = language === 'Hindi'
    ? {
        summary: reading.slice(0, 900),
        patterns: 'हर हथेली अलग होती है; रेखाओं की स्पष्टता और हाथ के आकार को एक सामान्य शुरुआत की तरह देखना बेहतर है।',
        reflection: 'इसे निश्चित भविष्यवाणी नहीं, बल्कि आत्म-चिंतन के एक सौम्य अवसर की तरह लें।'
      }
    : {
        summary: reading.slice(0, 900),
        patterns: 'Every palm is individual; line clarity and hand shape are best considered as a broad starting point.',
        reflection: 'Use this as a gentle moment for self-awareness, not as a fixed prediction.'
      };
  try {
    const clean = reading.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed: unknown = JSON.parse(clean);
    if (!isRecord(parsed)) return fallback;
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const patterns = typeof parsed.patterns === 'string' ? parsed.patterns.trim() : '';
    const reflection = typeof parsed.reflection === 'string' ? parsed.reflection.trim() : '';
    if (!summary || !patterns || !reflection) return fallback;
    return { summary: summary.slice(0, 900), patterns: patterns.slice(0, 900), reflection: reflection.slice(0, 600) };
  } catch {
    return fallback;
  }
}

function palmProviderMessage(status: number) {
  if (status === 401 || status === 403) return 'The free palm reflection needs an updated Gemini access key. Please try again later or request a personal reading.';
  if (status === 429) return 'Today’s free palm-reflection capacity has been reached. Please try again later.';
  if (status === 400 || status === 404) return 'The free palm reflection is being updated. Please try again shortly or request a personal reading.';
  return 'The free palm reflection is temporarily unavailable. Please try again later or request a personal reading.';
}

function isTransientPalmProviderStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

async function requestPalmReflectionFromGemini(apiKey: string, body: Record<string, unknown>) {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body)
    });
    if (response.ok || !isTransientPalmProviderStatus(response.status) || attempt === 1) return response;
    await new Promise((resolve) => setTimeout(resolve, 550 + Math.round(Math.random() * 250)));
  }
  return response!;
}

async function palmReflection(request: Request, env: Env) {
  if (!env.GEMINI_API_KEY) return json({ error: 'The free palm reflection is being set up. Please try again shortly or request a personal reading.' }, 503);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'This request must come from clickjyotish.in.' }, 403);
  const retryAfterMinutes = palmRateLimit(request);
  if (retryAfterMinutes !== null) return json({ error: `Please wait about ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? '' : 's'} before another free reflection.` }, 429);

  let input: PalmReflectionInput;
  try { input = await request.json(); } catch { return json({ error: 'Invalid image request.' }, 400); }
  if (input.consent !== true || !isPalmImage(input.image, input.mimeType)) {
    return json({ error: 'Please provide a clear JPG, PNG or WebP photo of the palm and confirm consent.' }, 400);
  }
  const language: 'English' | 'Hindi' = input.language === 'hi' ? 'Hindi' : 'English';
  const prompt = `You are writing a respectful general Hastarekha (traditional Indian palmistry) reflection from one image of the visitor's active (dominant) hand. First check whether the image shows a clear, open human palm with the whole palm and fingers visible. If it does not, reply with exactly UNCLEAR_PALM. If it does, write natural ${language}. Return ONLY one valid JSON object, with no markdown or extra text, exactly using these fields: {"summary":"...","patterns":"...","reflection":"..."}. Keep each value to 1-2 short sentences (maximum 42 words each), easy to read on a phone. Summary: a gentle overall observation. Patterns: visible line/shape themes only. Reflection: one practical self-awareness invitation and mention that a personal Palmistry consultation can explore the person's question in more depth. Use tentative language such as “may suggest” and “can invite reflection.” Do not make promises, certainty claims, exact dates or ages, or predictions about marriage, death, lifespan, pregnancy, health, disease, mental health, crime, legal matters, money, gambling, or investing. Do not diagnose age, gender, ethnicity, or any sensitive trait. Do not mention that you are AI. This is entertainment and spiritual reflection, not professional advice.`;
  const providerBody = {
    // Gemini 2.5 Flash-Lite is restricted for new projects. This current lightweight
    // multimodal model accepts image input and avoids a paid image-generation model.
    model: 'gemini-3.5-flash-lite',
    input: [
      { type: 'text', text: prompt },
      { type: 'image', data: input.image, mime_type: input.mimeType }
    ]
  };

  try {
    const response = await requestPalmReflectionFromGemini(env.GEMINI_API_KEY, providerBody);
    if (!response.ok) {
      console.error('Palm reflection provider failed', response.status);
      return json({ error: palmProviderMessage(response.status) }, response.status === 429 ? 429 : 502);
    }
    const reading = geminiText(await response.json());
    if (!reading) return json({ error: 'The free palm reflection could not be completed. Please try another clear photo.' }, 502);
    if (reading === 'UNCLEAR_PALM') return json({ title: language === 'Hindi' ? 'कृपया एक और फोटो लें' : 'Please try another photo', reading: language === 'Hindi' ? 'खुली हथेली साफ़ दिखाई नहीं दे रही है। पूरी हथेली के साथ अधिक रोशनी वाली स्पष्ट फोटो फिर से आज़माएं।' : 'I could not clearly see an open palm. Please try a brighter, sharper photo with the whole palm visible.' });
    const sections = palmSections(reading, language);
    return json({ title: language === 'Hindi' ? 'एक सौम्य दृष्टि' : 'A gentle reflection', reading: sections.summary, sections });
  } catch (error) {
    console.error('Palm reflection request failed', error);
    return json({ error: 'The free palm reflection is temporarily unavailable. Please try again later or request a personal reading.' }, 502);
  }
}

function dashboardHtml() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Click Jyotish · Lead Inbox</title><style>
*{box-sizing:border-box}body{margin:0;background:#f6f3ec;color:#18213d;font:15px system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:1280px;margin:0 auto;padding:32px 20px}h1{margin:0;font-size:28px}p{color:#566276}.head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:20px}.badge{background:#18213d;color:#fff;border-radius:99px;padding:8px 12px;font-weight:700;font-size:13px}button,select,input{font:inherit;border:1px solid #d6cfc1;border-radius:7px;padding:8px 10px;background:white;color:#18213d}button{cursor:pointer;background:#b77a27;color:#fff;border:0;font-weight:700}button:hover{background:#8d5e1e}.tools{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}.tools input{min-width:240px;flex:1}.tools .download{background:#18213d}.tools .download:hover{background:#303c61}.card{background:#fff;border:1px solid #e5dfd3;border-radius:12px;overflow:auto;box-shadow:0 6px 25px #3828090b}table{width:100%;border-collapse:collapse;min-width:1080px}th,td{text-align:left;padding:13px;border-bottom:1px solid #eee8df;vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#746c61;background:#fbfaf7}.name{font-weight:800}.muted{color:#687385;font-size:13px}.reply{display:inline-block;margin-top:8px;color:#fff;background:#1eaa59;border-radius:5px;padding:6px 8px;text-decoration:none;font-size:12px;font-weight:800}.reply:hover{background:#158043}.question{max-width:280px;white-space:pre-wrap}.empty{text-align:center;padding:42px;color:#687385}@media(max-width:680px){.head{display:block}.badge{display:inline-block;margin-top:10px}.tools input{min-width:100%}}
</style></head><body><main class="wrap"><div class="head"><div><h1>Click Jyotish Lead Inbox</h1><p>Private consultation requests from clickjyotish.in</p></div><div><span class="badge" id="count">Loading…</span> <button id="refresh">Refresh</button></div></div><div class="tools"><input id="search" type="search" placeholder="Search name, phone, email or question"><select id="statusFilter"><option value="">All statuses</option><option value="new">New</option><option value="contacted">Contacted</option><option value="booked">Booked</option><option value="closed">Closed</option></select><select id="sourceFilter"><option value="">All sources</option></select><button class="download" id="download">Download CSV</button><button class="download" id="testAlert">Test Google alert</button><span class="muted" id="alertResult" role="status"></span></div><section class="card"><table><thead><tr><th>Received</th><th>Client</th><th>Consultation</th><th>Birth details</th><th>Question</th><th>Source</th><th>Status</th></tr></thead><tbody id="leads"><tr><td colspan="7" class="empty">Loading leads…</td></tr></tbody></table></section></main><script>
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
document.querySelector('#refresh').onclick=load;document.querySelector('#download').onclick=downloadCsv;document.querySelector('#testAlert').onclick=async()=>{const button=document.querySelector('#testAlert'),result=document.querySelector('#alertResult');button.disabled=true;result.textContent='Sending test…';try{const r=await fetch('/api/leads/test-alert',{method:'POST'}),data=await r.json();if(!r.ok)throw Error(data.details||data.error||'The test alert failed.');result.textContent='✓ '+data.message;load()}catch(error){result.textContent='⚠ '+(error.message||'The test alert failed.')}finally{button.disabled=false}};search.oninput=render;statusFilter.onchange=render;sourceFilter.onchange=render;load();
</script></body></html>`;
}

type AlertPayload = {
  id: number | string;
  name: string;
  phone: string;
  email: string;
  dob: string;
  tob: string;
  pob: string;
  service: string;
  language: string;
  preferredSlot: string;
  question: string;
  source: string;
  status: string;
  createdAt: string;
  isTest?: boolean;
};

async function sendLeadAlert(webhookUrl: string, payload: AlertPayload) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload)
  });
  const responseText = (await response.text()).trim();
  if (!response.ok) throw new Error(`Webhook returned ${response.status}${responseText ? `: ${responseText.slice(0, 240)}` : ''}`);
  return responseText.slice(0, 500);
}

async function testLeadAlert(env: Env) {
  if (!env.LEAD_WEBHOOK_URL) return json({ error: 'Lead alert is not configured. Add the LEAD_WEBHOOK_URL secret first.' }, 400);
  const payload: AlertPayload = {
    id: 'test', name: 'Click Jyotish test lead', phone: '917669655530', email: 'support@clickjyotish.in',
    dob: '', tob: '', pob: 'New Delhi, India', service: 'Lead alert connection test', language: 'English',
    preferredSlot: '', question: 'This is a test alert. No client action is needed.',
    source: 'Test alert — Click Jyotish', status: 'test', createdAt: new Date().toISOString(), isTest: true
  };
  try {
    const response = await sendLeadAlert(env.LEAD_WEBHOOK_URL, payload);
    return json({ ok: true, message: 'Google Sheets accepted the test alert. Check for the test row and email now.', response: response || 'No response body returned.' });
  } catch (error) {
    console.error('Lead alert test failed', error);
    return json({ error: 'The alert endpoint did not accept the test.', details: error instanceof Error ? error.message : 'Unknown webhook error.' }, 502);
  }
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
  if (!lead.name || !lead.phone || !lead.service || (needsBirthDetails && (!lead.dob || !lead.pob)) || (needsServiceQuestion && !lead.question)) {
    return json({ error: 'Please complete all required details.' }, 400);
  }
  if (lead.email && !/^\S+@\S+\.\S+$/.test(lead.email)) return json({ error: 'Enter a valid email address.' }, 400);
  const result = await env.LEADS_DB.prepare(`INSERT INTO leads (name, phone, email, dob, tob, pob, service, language, preferred_slot, question, source, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`).bind(lead.name, lead.phone, lead.email, lead.dob, lead.tob, lead.pob, lead.service, lead.language, lead.preferredSlot, lead.question, lead.source).run();
  const id = Number(result.meta.last_row_id);
  if (env.LEAD_WEBHOOK_URL) {
    const payload: AlertPayload = { id, ...lead, status: 'new', createdAt: new Date().toISOString() };
    ctx.waitUntil(sendLeadAlert(env.LEAD_WEBHOOK_URL, payload).catch((error) => console.error('Lead alert delivery failed', error)));
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
    if (url.pathname === '/api/panchang' && request.method === 'GET') return dailyPanchang(env, url.searchParams.get('city'));
    if (url.pathname === '/api/palm-reading' && request.method === 'POST') return palmReflection(request, env);
    if (url.pathname === '/api/leads' && request.method === 'POST') return submitLead(request, env, ctx);
    if (url.pathname === '/api/leads' && request.method === 'GET') {
      const denied = requireAdmin(request, env); return denied ?? listLeads(request, env);
    }
    if (url.pathname === '/api/leads/test-alert' && request.method === 'POST') {
      const denied = requireAdmin(request, env); return denied ?? testLeadAlert(env);
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
