# Click Jyotish: simple WhatsApp Business lead workflow

The private website lead inbox at `https://clickjyotish.in/admin/leads` is the source of truth for new requests. WhatsApp Business is for the personal conversation. Its app labels/lists do **not** automatically sync with the website inbox, and a website form submission does **not** send an automatic WhatsApp message from the business number.

## One-time setup in the WhatsApp Business phone app

1. In **Tools → Business profile**, confirm the website `https://clickjyotish.in`, business name, and your actual working hours. Do not advertise 24-hour availability unless you provide it.
2. In **Tools → Greeting message**, turn it on for new chats. Suggested message: “Namaste, thank you for contacting Click Jyotish. This is Deepak Maheshwari. Please tell me whether your question is about Kundali, Palmistry or Vastu, and your preferred language. I will review it and reply personally.”
3. In **Tools → Away message**, turn it on for **outside business hours** only after your hours are correct. Suggested message: “Thank you for your message. I’m away right now, but I’ll read your enquiry and reply during my working hours. Please don’t send payment until we confirm your consultation details.”
4. In **Tools → Quick replies**, add the shortcuts below. They are drafts for you to review and personalise before sending; they are not automatic replies.
5. Use **Labels** or **Lists** (whichever your app shows): `New enquiry`, `Awaiting details`, `Time offered`, `Booked`, `Completed`. Apply one matching label/list to each active chat.

| Shortcut | Message to save |
| --- | --- |
| `/received` | “Namaste [Name], this is Deepak from Click Jyotish. I received your [service] enquiry. I’ll review your question and confirm a suitable time with you here.” |
| `/details` | “For a Kundali consultation, please confirm your date and place of birth. Share your birth time if known; if it isn’t known, please say so rather than estimating it.” |
| `/slot` | “I can offer [day, date] at [time] IST for your [service] consultation. Does that time work for you?” |
| `/confirm` | “Your [service] consultation is confirmed for [day, date] at [time] IST. The fee is [amount] as shown for this service. I will share the payment method and call details personally.” |
| `/followup` | “Namaste [Name], checking whether you still want to arrange the [service] consultation we discussed. No problem if you prefer to wait.” |

Replace the square-bracket fields before sending. Never put a generic fee into the greeting or away message; Vastu and other services may have different pricing. Do not include sensitive birth details in automated messages or marketing broadcasts.

## Daily routine (about five minutes)

1. Open the website inbox and keep the default **New leads to reply** filter.
2. Open a lead’s WhatsApp chat, review the prefilled reply, and actually send it. The existing inbox button marks a new lead **Contacted** when you click it, so make sure the message is sent before moving on.
3. If details are missing, use `/details`; otherwise offer a specific IST time with `/slot`.
4. Set the website lead status to **Booked** only after both sides confirm the time. Apply the matching WhatsApp label/list manually.
5. Optionally send one polite `/followup` to an unanswered active enquiry. Do not broadcast to leads who only submitted a form; that is not consent to receive promotions.

WhatsApp Business app features can send greeting/away messages when **the customer messages your business**. Fully automatic outbound messages triggered by website forms require the official WhatsApp Business Platform/API, approved templates where applicable, and a separate integration. Do not use unofficial browser-bot extensions for this.
