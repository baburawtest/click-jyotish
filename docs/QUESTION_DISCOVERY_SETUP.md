# Weekly question discovery

This free GitHub Actions workflow finds recurring, public **questions** beneath recent YouTube videos about Vedic astrology, Palmistry and Vastu. Every Monday it creates one GitHub Issue with a small, anonymised editorial queue.

It does **not** copy comments, contact commenters, generate answers, publish pages, or use OpenAI credits. Its job is to reveal what people are already curious about. Deepak reviews each candidate before an original Click Jyotish answer is written.

## One-time setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create or choose a project.
2. Enable **YouTube Data API v3** for that project.
3. Create an API key. Under **API restrictions**, restrict it to **YouTube Data API v3**. Keep the key private.
4. Open GitHub repository **Settings → Secrets and variables → Actions → New repository secret**.
5. Set the name to `YOUTUBE_API_KEY`, paste the key, then save.

No code needs to be changed after this. Run **Actions → Discover short-answer content questions → Run workflow** to test it, or wait for Monday 8:45 AM India time.

## Editorial rule

Treat every result as a topic signal—not a verified fact or a promised outcome. Publish only questions that Deepak can answer from real experience, in an original page with a clear answer, bilingual copy where useful, author attribution, a relevant internal link and a review date.

Google can use useful indexed pages in AI search experiences, but there is no legitimate way to guarantee inclusion. The best route is concise, original and expert-reviewed content.
