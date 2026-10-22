# Free palm reflection setup

The `/palm-reading/` page works only after the `GEMINI_API_KEY` secret is added to the Click Jyotish Cloudflare Worker. It uses Gemini 3.5 Flash-Lite for low-cost image understanding; Google controls whether free quota is available for the account and project.

## Create the free key

1. Sign in with the Google account that will own the key.
2. Open [Google AI Studio API keys](https://aistudio.google.com/app/apikey).
3. Select **Create API key** and copy the newly created **auth key**. Do not use an old unrestricted standard key.
4. Do not paste the key in GitHub, an Astro source file, WhatsApp, or a screenshot.

Google's free API tier has rate limits. Submitted images may be used by Google to improve its products, which is why the website shows an explicit consent checkbox before a photo is sent.

## Add it to Cloudflare

1. Open **Cloudflare Dashboard → Workers & Pages → click-jyotish → Settings → Variables and Secrets**.
2. Under **Production**, choose **Add variable**.
3. Set the name to `GEMINI_API_KEY`.
4. Paste the key as the value and enable **Encrypt** / **Secret**.
5. Save, then deploy the latest version of the Worker.

The key stays only in Cloudflare. The browser sends photos to `/api/palm-reading`; the Worker forwards them to Gemini. The photos are not inserted into the Click Jyotish lead database and are not stored by the Worker.

## Test after deployment

1. Visit `https://clickjyotish.in/palm-reading/`.
2. Upload a clear photo of the active/dominant hand (the hand used most), tick consent, and submit.
3. Confirm a general reflection appears.
4. If the photo is unclear, take one better photo and try again. The server intentionally allows at most two requests per visitor in 24 hours to protect the free API allowance.

If the key is absent or the free quota is unavailable, the page shows a temporary-unavailable message rather than exposing the secret or an API error. If the website says it needs an updated Gemini key, open the AI Studio **API Keys** page, create a new auth key, replace the Cloudflare `GEMINI_API_KEY` secret, and redeploy. AI Studio also shows whether a key is blocked and the active rate limits.
