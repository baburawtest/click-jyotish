# Click Jyotish lead inbox setup

The website can save consultation requests in a private Cloudflare D1 database. This keeps birth details off visitors' browsers and gives Deepak one inbox at:

`https://clickjyotish.in/admin/leads`

## One-time Cloudflare setup

1. Commit and push the current `main` branch. Cloudflare will create and attach the D1 database automatically during that deployment; the database ID stays in Cloudflare, not in GitHub.
2. Once the deployment is ready, open **Workers & Pages** → **D1 SQL Database** and open the newly created Click Jyotish database.
3. Use the database **Console** tab. Copy and run the full contents of `schema.sql` from this repository. It creates the lead table.
4. In the `click-jyotish` Worker, open **Settings** → **Variables and Secrets**, and add two encrypted secrets:
   - `ADMIN_USERNAME` — choose a private username, for example `deepak`
   - `ADMIN_PASSWORD` — choose a long, unique password
5. Deploy the current `main` branch from GitHub once more if Cloudflare asks for it. Do not change DNS, domains, or Worker name.

After that, submit one test form on the website. Open `https://clickjyotish.in/admin/leads`, enter the private username and password, and the test lead will be visible. Change its status from **New** to **Contacted**, **Booked**, or **Closed** as you work.

## Optional automation

The inbox already stores every request. When you are ready, add an encrypted Worker secret named `LEAD_WEBHOOK_URL` with a Google Apps Script, Make, or Zapier webhook URL. Each new lead will then be forwarded to that automation as well. Do not add this secret until the chosen automation is ready.

## Privacy

Birth details are sensitive. Never put the admin password, a database ID, or a webhook URL in the website source. Cloudflare encrypted secrets keep them out of GitHub.
