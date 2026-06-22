// Klaviyo newsletter opt-in. Uses Klaviyo's public client-side subscribe
// endpoint, which only needs the public API key (Site ID / company_id) — safe to
// ship in the browser. It subscribes the email to the configured list and
// honours that list's opt-in settings (single or double opt-in confirmation).
//
// Fill these two in from your Klaviyo account, then it activates automatically:
//   PUBLIC KEY  – Klaviyo → Settings → API keys → "Public API key (Site ID)" (6 chars)
//   LIST ID     – Klaviyo → Audience → Lists & Segments → open your list →
//                 Settings (or the URL), the List ID (6 chars)

const KLAVIYO_PUBLIC_KEY = "RiR6KU"; // Studio Nicholas public API key / Site ID
const KLAVIYO_LIST_ID = "TKWRew"; // Portal sign-ups list

export const klaviyoConfigured = () => !!(KLAVIYO_PUBLIC_KEY && KLAVIYO_LIST_ID);

// Best-effort: subscribe an email to the news list. Never throws to the UI.
export async function subscribeToNews(email, firstName, lastName) {
  const addr = (email || "").trim();
  if (!klaviyoConfigured() || !addr) return;
  try {
    const profileAttrs = {
      email: addr,
      subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
    };
    if (firstName) profileAttrs.first_name = firstName;
    if (lastName) profileAttrs.last_name = lastName;

    await fetch(`https://a.klaviyo.com/client/subscriptions/?company_id=${KLAVIYO_PUBLIC_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", revision: "2024-10-15" },
      body: JSON.stringify({
        data: {
          type: "subscription",
          attributes: { profile: { data: { type: "profile", attributes: profileAttrs } } },
          relationships: { list: { data: { type: "list", id: KLAVIYO_LIST_ID } } },
        },
      }),
    });
  } catch (e) {
    console.error("klaviyo subscribe failed", e);
  }
}
