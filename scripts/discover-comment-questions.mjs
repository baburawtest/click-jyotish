const apiKey = process.env.YOUTUBE_API_KEY?.trim();

// This workflow is deliberately a discovery tool, not an auto-publisher.
// A real practitioner must review every question and answer before publishing.
if (!apiKey) {
  console.log('Question discovery skipped: add the YOUTUBE_API_KEY GitHub repository secret to enable it.');
  process.exit(0);
}

const repository = process.env.GITHUB_REPOSITORY;
const githubToken = process.env.GITHUB_TOKEN;
if (!repository || !githubToken) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required to create the private review issue.');

const today = new Date().toISOString().slice(0, 10);
const searches = [
  { category: 'Vedic astrology', query: 'Vedic astrology moon sign kundali questions Hindi', videos: 3 },
  { category: 'Palmistry', query: 'Hastrekha palmistry questions Hindi', videos: 3 },
  { category: 'Vastu', query: 'Vastu Shastra home questions Hindi', videos: 3 }
];

const questionWords = /[?？]|\b(what|why|when|where|which|who|how|can|does|do|is|are|will|should|kya|kyun|kaise|kab|kahan|kaun|konsa|konsi|kya)\b|क्या|क्यों|कैसे|कब|कहाँ|कौन|कौनसा|कौनसी|बताइए|बताये|बताओ|समझाइए|समझाएं/i;
const phoneOrEmail = /(?:\+?\d[\d\s().-]{7,}\d)|(?:[\w.+-]+@[\w-]+\.[\w.-]+)/g;

function cleanQuestion(value) {
  return String(value ?? '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(phoneOrEmail, '[private detail removed]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function isQuestion(value) {
  return value.length >= 14 && questionWords.test(value);
}

async function youtube(path, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [key, value] of Object.entries({ ...params, key: apiKey })) url.searchParams.set(key, String(value));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`YouTube API ${path} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function recentVideos(search) {
  const publishedAfter = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const data = await youtube('search', {
    part: 'snippet', type: 'video', q: search.query, order: 'date', maxResults: search.videos, publishedAfter
  });
  return (data.items ?? []).map((item) => item.id?.videoId).filter(Boolean);
}

async function questionsForVideo(videoId, category) {
  try {
    const data = await youtube('commentThreads', {
      part: 'snippet', videoId, order: 'relevance', textFormat: 'plainText', maxResults: 50
    });
    return (data.items ?? []).map((thread) => {
      const comment = thread?.snippet?.topLevelComment?.snippet ?? {};
      const question = cleanQuestion(comment.textOriginal || comment.textDisplay);
      return {
        category,
        question,
        likes: Number(comment.likeCount || 0),
        source: `https://www.youtube.com/watch?v=${videoId}`
      };
    }).filter((candidate) => isQuestion(candidate.question));
  } catch (error) {
    // Comments may be disabled for a video. Continue with the other sources.
    console.warn(`Skipping comments for ${videoId}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

const discovered = [];
for (const search of searches) {
  const videoIds = await recentVideos(search);
  for (const videoId of videoIds) discovered.push(...await questionsForVideo(videoId, search.category));
}

const unique = new Map();
for (const candidate of discovered) {
  const key = candidate.question.toLocaleLowerCase('en-IN').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const existing = unique.get(key);
  if (!existing || candidate.likes > existing.likes) unique.set(key, candidate);
}
const candidates = [...unique.values()]
  .sort((a, b) => b.likes - a.likes || a.question.localeCompare(b.question))
  .slice(0, 15);

function issueBody() {
  if (!candidates.length) {
    return `# Weekly question discovery\n\nNo usable public questions were found this week. Try again next Monday or run this workflow manually.\n\nThis workflow does not publish content automatically.`;
  }
  const groups = Object.groupBy(candidates, ({ category }) => category);
  const sections = Object.entries(groups).map(([category, items]) => [
    `## ${category}`,
    ...items.map((item, index) => `${index + 1}. **${item.question}**  \n   Public source: ${item.source}`)
  ].join('\n')).join('\n\n');
  return `# Weekly question discovery\n\nThese are anonymised question candidates found in recent public YouTube discussion. They are signals for original, helpful pages—not text to copy and not a reason to promise predictions.\n\n${sections}\n\n---\n\n## Before creating a Click Jyotish page\n\n- Select only questions Deepak can answer from genuine experience.\n- Write an original, concise answer in English and Hindi; avoid guaranteed outcomes, fear, health, legal, financial or time-sensitive claims.\n- Add the author, a relevant internal link, a short FAQ only when useful, and a "reviewed on" date.\n- Create the page as a draft first. Do not publish automatically.\n\nGoogle's AI features may cite useful, indexed pages, but visibility is never guaranteed.`;
}

const title = `Question discovery — ${today}`;
const headers = { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
const existingResponse = await fetch(`https://api.github.com/repos/${repository}/issues?state=open&per_page=100`, { headers });
if (!existingResponse.ok) throw new Error(`Could not check existing GitHub issues: ${existingResponse.status}`);
const existing = (await existingResponse.json()).find((issue) => issue.title === title);
const issueUrl = `https://api.github.com/repos/${repository}/issues${existing ? `/${existing.number}` : ''}`;
const issueResponse = await fetch(issueUrl, {
  method: existing ? 'PATCH' : 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify(existing ? { body: issueBody() } : { title, body: issueBody() })
});
if (!issueResponse.ok) throw new Error(`Could not ${existing ? 'update' : 'create'} review issue: ${issueResponse.status} ${await issueResponse.text()}`);
const issue = await issueResponse.json();
console.log(`QUESTION_CANDIDATES=${candidates.length}`);
console.log(`REVIEW_ISSUE=${issue.html_url}`);
