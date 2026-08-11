// Cloudflare Pages Function
// Handles POST /api/customize-request
// Sends a transactional email via Brevo to steven@medjay.pro with the
// submitted "Customize Your Course" request.
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

  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const industry = (body.industry || '').trim();
  const teamSize = (body.teamSize || '').trim();
  const need = (body.need || '').trim();

  if (!name || !email || !industry || !teamSize || !need) {
    return jsonResponse({ message: 'Please fill in all fields.' }, 400);
  }

  if (!isValidEmail(email)) {
    return jsonResponse({ message: 'Please enter a valid email address.' }, 400);
  }

  if (!env.BREVO_API_KEY) {
    return jsonResponse({ message: 'Server not configured. Please try again later.' }, 500);
  }

  const htmlContent = `
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Industry:</strong> ${escapeHtml(industry)}</p>
    <p><strong>Team Size:</strong> ${escapeHtml(teamSize)}</p>
    <p><strong>What they need:</strong><br>${escapeHtml(need).replace(/\n/g, '<br>')}</p>
  `;

  try {
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'MEDJAY Website', email: 'steven@medjay.pro' },
        to: [{ email: 'steven@medjay.pro' }],
        replyTo: { email: email, name: name },
        subject: `Customize Request: ${name} (${industry})`,
        htmlContent,
      }),
    });

    if (brevoRes.ok) {
      return jsonResponse({ message: "Thanks — we'll be in touch shortly." }, 200);
    }

    return jsonResponse({ message: 'Something went wrong. Please try again.' }, 502);
  } catch (err) {
    return jsonResponse({ message: 'Something went wrong. Please try again.' }, 500);
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
