// Cloudflare Pages Function
// Handles POST /api/subscribe
// Adds the submitted email to Brevo list #26 (Medjay Newsletter)
//
// SETUP REQUIRED (one-time, in Cloudflare dashboard):
// Pages project -> Settings -> Environment variables -> add:
//   BREVO_API_KEY = <your Brevo API key, kept secret, never in the HTML/JS>
//
// The API key never reaches the browser — it lives only here, server-side.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ message: 'Invalid request.' }, 400);
  }

  const email = (body.email || '').trim();

  if (!isValidEmail(email)) {
    return jsonResponse({ message: 'Please enter a valid email address.' }, 400);
  }

  if (!env.BREVO_API_KEY) {
    return jsonResponse({ message: 'Server not configured. Please try again later.' }, 500);
  }

  try {
    const brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        email: email,
        listIds: [26],
        updateEnabled: true,
      }),
    });

    // Brevo returns 201 on new contact, 204 on update, or 400 with
    // "Contact already exist" if they're already subscribed — all of
    // these mean the person is now on the list, so treat them as success.
    if (brevoRes.ok || brevoRes.status === 204) {
      return jsonResponse({ message: "You're in. Welcome to the list." }, 200);
    }

    const errData = await brevoRes.json().catch(() => ({}));
    if (errData.code === 'duplicate_parameter') {
      return jsonResponse({ message: "You're already on the list." }, 200);
    }

    return jsonResponse({ message: 'Something went wrong. Please try again.' }, 502);
  } catch (err) {
    return jsonResponse({ message: 'Something went wrong. Please try again.' }, 500);
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
