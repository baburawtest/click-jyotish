import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error('OPENAI_API_KEY is missing. Add it as a GitHub Actions secret.');
const today = new Date().toISOString().slice(0, 10);
const manualTopic = process.env.BLOG_TOPIC?.trim();

async function signals() {
  if (manualTopic) return [manualTopic];
  try {
    const feed = await fetch('https://news.google.com/rss/search?q=(Vedic%20astrology%20OR%20Vastu%20OR%20Hindu%20festival)%20India%20when:14d&hl=en-IN&gl=IN&ceid=IN:en');
    const xml = await feed.text();
    return [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g)]
      .map(m => (m[1] || m[2] || '').trim()).filter(x => x && x !== 'Google News').slice(0, 8);
  } catch { return ['Moon-sign guidance for readers of Vedic astrology']; }
}

const ideas = await signals();
const prompt = `Write an original 700-1000 word Markdown DRAFT for Click Jyotish, a New Delhi Vedic Astrology, Vastu and Palmistry practice. Today is ${today}. Topic ideas (inspiration only, not facts):\n${ideas.map(x => '- ' + x).join('\n')}\n\nChoose one useful topic. Include H2 headings, practical lists, a two-question FAQ and a soft consultation CTA. Use Indian English. Do not claim exact Panchang times, dates, transit degrees, remedies, health, legal or financial outcomes; tell readers to verify time-sensitive matters locally. No guarantees, fear, copied news or celebrity gossip. Use only these internal links when relevant: /vedic-astrology-consultation/, /vastu-consultation/, /palmistry-consultation/, /faq/, /blog/.\n\nRespond as JSON with: slug (lowercase hyphenated), title, description, category, tags (2-5 strings), body (markdown, no frontmatter), imagePrompt.`;
const schema = { type: 'object', additionalProperties: false, required: ['slug','title','description','category','tags','body','imagePrompt'], properties: { slug: {type:'string'}, title:{type:'string'}, description:{type:'string'}, category:{type:'string'}, tags:{type:'array',items:{type:'string'}}, body:{type:'string'}, imagePrompt:{type:'string'} } };
const res = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}, body:JSON.stringify({model:process.env.OPENAI_MODEL || 'gpt-4o-mini',input:prompt,text:{format:{type:'json_schema',name:'blog_draft',strict:true,schema}}}) });
if (!res.ok) throw new Error(`OpenAI request failed: ${res.status} ${await res.text()}`);
const article = JSON.parse((await res.json()).output_text);
const slug = article.slug.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90);
if (!slug || !article.body.includes('##')) throw new Error('Draft output was incomplete.');
const q = x => JSON.stringify(String(x));
const markdown = ['---',`title: ${q(article.title)}`,`description: ${q(article.description)}`,`pubDate: ${today}`,`category: ${q(article.category)}`,`tags: [${article.tags.map(q).join(', ')}]`,'draft: true','featured: false','---','', '> **Editorial review required:** Verify all factual, cultural, spiritual and time-sensitive statements before changing `draft: true` to `draft: false`.','',article.body.trim(),'','---','',`**Suggested cover-image brief:** ${article.imagePrompt.trim()}`,''].join('\n');
const path = join(process.cwd(), 'src', 'data', 'blog', `${today}-${slug}.md`);
await mkdir(join(process.cwd(), 'src', 'data', 'blog'), {recursive:true});
await writeFile(path, markdown, 'utf8');
console.log(`BLOG_FILE=${path}`);