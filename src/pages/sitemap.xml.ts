import { getCollection } from 'astro:content';

export const prerender = true;

const siteUrl = 'https://clickjyotish.in';
const staticPaths = [
  '/',
  '/hi/',
  '/astrologer-in-new-delhi/',
  '/hi/astrologer-in-new-delhi/',
  '/faq/',
  '/hi/faq/',
  '/privacy-policy/',
  '/terms-and-conditions/',
  '/disclaimer/',
  '/refund-and-rescheduling/',
  '/vedic-astrology-consultation/',
  '/hi/vedic-astrology-consultation/',
  '/vastu-consultation/',
  '/hi/vastu-consultation/',
  '/palmistry-consultation/',
  '/hi/palmistry-consultation/',
  '/palm-reading/',
  '/blog/'
];

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
}[character] ?? character));

export async function GET() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const entries = [
    ...staticPaths.map((path) => ({ path, lastmod: undefined as string | undefined })),
    ...posts.map((post) => ({
      path: `/blog/${post.id}/`,
      lastmod: (post.data.updatedDate ?? post.data.pubDate).toISOString().slice(0, 10)
    }))
  ];
  const urls = entries.map(({ path, lastmod }) =>
    `  <url><loc>${escapeXml(`${siteUrl}${path}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
  ).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
}
