# Google Sheets lead alerts

Use this script in the Google Apps Script project attached to the spreadsheet where you want to receive Click Jyotish leads. It accepts the JSON sent by the website, adds every lead to a `Leads` sheet, and emails `support@clickjyotish.in`.

1. In the target Google Sheet, select **Extensions → Apps Script**.
2. Replace the existing code with the script below. If this is a standalone Apps Script project instead, put the spreadsheet ID in `SPREADSHEET_ID`.
3. Select **Deploy → Manage deployments → Edit**. Set **Execute as: Me** and **Who has access: Anyone**, then deploy a new version. Authorise it when Google asks.
4. In Cloudflare, keep the deployed `/exec` URL as the `LEAD_WEBHOOK_URL` secret. Do not use the `/dev` URL.
5. After the website deploys, open `/admin/leads` and select **Test Google alert**. A row headed `Click Jyotish test lead` and an email should arrive.

```javascript
const SHEET_NAME = 'Leads';
const NOTIFICATION_EMAIL = 'support@clickjyotish.in';
// Leave blank for a script opened from the target Google Sheet.
// For a standalone script, paste the ID from the Sheet URL between /d/ and /edit.
const SPREADSHEET_ID = '';

function doPost(e) {
  try {
    const lead = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    if (!lead.name || !lead.phone || !lead.service) throw new Error('Required lead details are missing.');

    const spreadsheet = SPREADSHEET_ID
      ? SpreadsheetApp.openById(SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Received at', 'Name', 'WhatsApp', 'Email', 'Consultation', 'Language', 'Date of birth', 'Time of birth', 'Place of birth', 'Preferred time', 'Question', 'Source', 'Status']);
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      lead.createdAt || new Date().toISOString(), lead.name, lead.phone, lead.email || '',
      lead.service, lead.language || '', lead.dob || '', lead.tob || '', lead.pob || '',
      lead.preferredSlot || '', lead.question || '', lead.source || 'Click Jyotish Website', lead.status || 'new'
    ]);

    const subject = lead.isTest ? 'Click Jyotish: lead alert test successful' : `New Click Jyotish lead: ${lead.name}`;
    const body = [
      `Name: ${lead.name}`,
      `WhatsApp: ${lead.phone}`,
      `Email: ${lead.email || 'Not supplied'}`,
      `Consultation: ${lead.service}`,
      `Preferred time: ${lead.preferredSlot || 'Not supplied'}`,
      `Question: ${lead.question || 'Not supplied'}`,
      `Source: ${lead.source || 'Click Jyotish Website'}`
    ].join('\n');
    MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);

    return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Lead stored and email sent.' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

The Apps Script execution page showing `Completed` only means Google ran the script. The **Test Google alert** result, the test row in the sheet, and the email together confirm that the full alert path works.
