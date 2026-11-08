# Messaging and notification delivery

## In-app conversations

Migration `0029_user_messaging.sql` adds direct one-to-one conversations shared
by the web portal and Expo mobile app. Messages are private to their two
participants, limited to 4,000 characters, and sent through a permission-checked
database function. Students and parents can contact approved college staff;
approved college staff can contact students, parents, and colleagues in their
own institution. Tutors are limited to students they teach and parents linked
to those students. Account approval, institution boundary, and the MFA policy
are checked in Postgres. Reads use conversation membership policies, not UI
hiding.

The web route is `/messages`; mobile notifications open the same conversation
in the app. Messages update over Supabase Realtime and retain per-recipient read
time. The app keeps the latest 100 messages per open conversation and the
latest 100 conversations per user. There are no attachments, group chats, or
message editing/deletion in this first version.

## WhatsApp and push

App messages always create an in-app notification for the recipient. If that
recipient has WhatsApp alerts enabled and has a phone number, the system queues
a short private WhatsApp alert with a link back to the in-app conversation; it
does not copy the conversation text into WhatsApp. Native push alerts use the
recipient's registered Expo devices and include the deep link.

Each person controls SMS, WhatsApp, email, push, and a separate opt-in for
college-wide broadcasts in mobile Settings. In-app notices remain enabled.
The admin broadcast page creates notifications in idempotent pages of 150
recipients (maximum 200) and external delivery is queued only for recipients
who enabled both the relevant channel and broadcast opt-in.

To send WhatsApp notifications, configure the Supabase Edge Function secrets:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `WHATSAPP_FROM` as the approved Twilio WhatsApp sender
- `WHATSAPP_CONTENT_SID` as an approved WhatsApp Content Template SID
- `SITE_URL` as the deployed web app origin, so the alert link opens the app

The approved template must accept two variables. Use an approved utility
template equivalent to: `You have a new {{1}} from your college. Open the app: {{2}}`.
Variable 1 is the short alert title; variable 2 is the app or receipt link. The
actual private chat text is never sent over WhatsApp. Twilio requires an
approved template for business-initiated WhatsApp messages outside a 24-hour
customer-service window; the sender uses `ContentSid` and `ContentVariables`
instead of assuming a free-form message will be allowed. See [Twilio's WhatsApp
API guidance](https://www.twilio.com/docs/whatsapp/api) and [template sending
guide](https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates).

Also configure `EXPO_ACCESS_TOKEN` if the Expo project requires authenticated
push delivery. Without provider credentials/template, external delivery is
marked `blocked` in `message_outbox`; the in-app message and notification still
work. Email and SMS use their own existing provider secrets in
`send-outbound/index.ts`.

## Queue worker and operations

`send-outbound` is an HTTP worker. It claims rows with `FOR UPDATE SKIP LOCKED`,
processes provider requests in parallel, and returns an accepted response while
delivery continues in the Edge Function background. A message sender may
trigger only the notification rows created for that sender's own chat message;
the actual private text remains inside the college app. The chat API is one
request to persist each message and returns without waiting for WhatsApp.
Approved staff may request a bounded queue batch for their own institution;
the service-role scheduled worker can drain across institutions.

Configure a trusted platform scheduler or backend job to POST to
`/functions/v1/send-outbound` with a Supabase service-role bearer token and a
small JSON body such as `{"limit": 50}`. Keep the token in the scheduler's
secret store, never in browser/mobile configuration. The worker enforces a
maximum batch of 100 and retries failed sends up to five times. A `blocked`
provider setup row can be retried after its required secrets are configured.
Finance staff fee reminders and resend actions also trigger their institution's
queue immediately; routine system notifications need the scheduled worker.

Apply migrations `0027_import_reports.sql`, `0028_workflow_integrity_scale.sql`,
and `0029_user_messaging.sql` in order. Confirm table publication and function
deployment in staging. Do not claim live WhatsApp or push delivery until a real
recipient with opted-in preferences receives a test message from the configured
provider.
