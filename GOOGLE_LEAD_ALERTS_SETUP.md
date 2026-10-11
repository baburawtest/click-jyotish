# Click Jyotish: Google Sheets and Email Lead Alerts

This one-time setup keeps a backup of every website lead in Google Sheets and sends an email alert to `support@clickjyotish.in`.

## 1. Create the spreadsheet

1. Open [Google Sheets](https://sheets.new) while logged in to the Google account that should receive alerts.
2. Name it `Click Jyotish Leads`.
3. Click **Extensions → Apps Script**.
4. Delete any code in the editor and paste the script below.

```javascript
const SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE';
const ALERT_EMAIL = 'support@clickjyotish.in';
const WEBHOOK_TOKEN = 'CHOOSE_A_LONG_PRIVATE_TOKEN_HERE';

const HEADERS = [
  'Received at', 'Name', 'Phone', 'Email', 'Service', 'Language',
  'Date of birth', 'Time of birth', 'Place of birth', 'Preferred slot',
  'Question', 'Source', 'Status', 'Lead ID'
];

function doPost(e) {
  try {
    if (!e || !e.parameter || e.parameter.token !== WEBHOOK_TOKEN) {
      return jsonResponse({ ok: false, error: 'Unauthorized' });
    }

    const lead = JSON.parse(e.postData.contents || '{}');
    const sheet = getLeadsSheet();
    sheet.appendRow([
      lead.createdAt || new Date().toISOString(),
      lead.name || '', lead.phone || '', lead.email || '', lead.service || '',
      lead.language || '', lead.dob || '', lead.tob || '', lead.pob || '',
      lead.preferredSlot || '', lead.question || '', lead.source || 'Direct',
      lead.status || 'new', lead.id || ''
    ]);

    const subject = 'New Click Jyotish lead: ' + (lead.name || 'Website enquiry');
    const message = [
      'A new consultation request has arrived from clickjyotish.in.', '',
      'Name: ' + (lead.name || '—'),
      'Phone: ' + (lead.phone || '—'),
      'Email: ' + (lead.email || '—'),
      'Service: ' + (lead.service || '—'),
      'Preferred slot: ' + (lead.preferredSlot || '—'),
      'Question: ' + (lead.question || '—'),
      'Source: ' + (lead.source || 'Direct'), '',
      'Open the private lead inbox: https://clickjyotish.in/admin/leads'
    ].join('\n');
    GmailApp.sendEmail(ALERT_EMAIL, subject, message);

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function getLeadsSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName('Leads') || spreadsheet.insertSheet('Leads');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 2. Fill the three values at the top

- `SPREADSHEET_ID`: in the spreadsheet URL, copy the text between `/d/` and `/edit`.
- `ALERT_EMAIL`: leave `support@clickjyotish.in` as it is, or change it to the Gmail address that should receive alerts.
- `WEBHOOK_TOKEN`: replace the placeholder with a long private random value. Do not share it or commit it to GitHub.

## 3. Deploy it as a web app

1. In Apps Script, click **Deploy → New deployment**.
2. Choose **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone**.
5. Click **Deploy**, authorize Google when asked, and copy the web-app URL.
6. Add `?token=YOUR_PRIVATE_TOKEN` to the end of that URL. If there is already a `?` in the URL, use `&token=...` instead.

Example only:

```text
https://script.google.com/macros/s/EXAMPLE/exec?token=YOUR_PRIVATE_TOKEN
```

## 4. Connect the website

In Cloudflare: **Workers & Pages → click-jyotish → Settings → Variables and Secrets**.

Add an encrypted secret:

| Name | Value |
| --- | --- |
| `LEAD_WEBHOOK_URL` | Your complete URL from step 3, including `?token=...` |

Save/deploy it. Send a test consultation form submission. A new row should appear in the `Leads` tab and an email should arrive shortly after.

The website always keeps its own private copy of leads in Cloudflare D1, so this Google Sheet is an additional alert and backup—not the only record.
