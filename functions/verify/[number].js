// Cloudflare Pages Function
// Handles GET /verify/:number
//
// Public verification page: full name, course title, issue date, status
// (Valid / Revoked) and "Issued by MEDJAY". Never shows the email or the
// score. Unknown or malformed numbers get a clean 404 "not found" page;
// malformed numbers are rejected before any database query.
// noindex (meta + X-Robots-Tag).

import {
  getExam, isCertificateNo, formatIssueDate, LINKEDIN_PROFILE_URL, LINKEDIN_COMPANY_URL, levelLabel,
} from '../_lib/exam.js';
import { getCertificate } from '../_lib/exam-db.js';
import { escapeHtml, pageShell, htmlResponse, certNotFoundPage } from '../_lib/site.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const raw = String(params.number || '');
  const number = raw.toUpperCase();

  if (!isCertificateNo(number)) return htmlResponse(certNotFoundPage(), 404, { noindex: true });
  if (number !== raw) {
    return new Response(null, { status: 301, headers: { Location: `/verify/${number}`, 'X-Robots-Tag': 'noindex, nofollow' } });
  }
  if (!env.DB) return htmlResponse('Server not configured.', 500, { noindex: true });

  let cert;
  try {
    cert = await getCertificate(env.DB, number);
  } catch (err) {
    return htmlResponse('Something went wrong. Please try again.', 500, { noindex: true });
  }
  const exam = cert && getExam(cert.course_slug);
  if (!cert || !exam) return htmlResponse(certNotFoundPage(), 404, { noindex: true });

  return htmlResponse(renderVerify(cert, exam), 200, { noindex: true });
}

function renderVerify(cert, exam) {
  const valid = Number(cert.revoked) !== 1;
  const link = (href, text) => href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${text}</a>`
    : text;

  const bodyContent = `
<main id="main">
<section class="hero">
  <div class="wrap">
    <span class="eyebrow">Certificate verification</span>
    <h1>${valid ? 'This certificate is valid' : 'This certificate has been revoked'}</h1>
  </div>
</section>
<div class="watchline"></div>
<section>
  <div class="wrap">
    <dl class="vcard">
      <div><dt>Status</dt><dd><span class="badge ${valid ? 'ok' : 'bad'}">${valid ? 'Valid' : 'Revoked'}</span></dd></div>
      <div><dt>Full name</dt><dd class="v-name" dir="auto">${escapeHtml(cert.full_name)}</dd></div>
      <div><dt>Course</dt><dd>${escapeHtml(exam.title)} — ${levelLabel(exam)}</dd></div>
      <div><dt>Issue date</dt><dd>${escapeHtml(formatIssueDate(cert.issued_at))}</dd></div>
      <div><dt>Certificate No</dt><dd class="mono">${escapeHtml(cert.certificate_no)}</dd></div>
      <div><dt>Issuer</dt><dd>Issued by ${link(LINKEDIN_COMPANY_URL, 'MEDJAY')}${LINKEDIN_PROFILE_URL ? ` · Founder: ${link(LINKEDIN_PROFILE_URL, 'Steven Saad')}` : ''}</dd></div>
    </dl>
    ${valid ? `<p class="v-more"><a href="/certificate/${escapeHtml(cert.certificate_no)}">View certificate</a></p>` : ''}
  </div>
</section>
</main>`;

  const extraCss = `
  .vcard{max-width:720px; margin:0; border:1px solid rgba(201,162,75,0.35); background:linear-gradient(160deg, var(--navy-3), var(--navy)); border-radius:4px; padding:12px 28px;}
  .vcard > div{display:grid; grid-template-columns:160px 1fr; gap:16px; padding:16px 0; border-bottom:1px solid var(--line);}
  .vcard > div:last-child{border-bottom:none;}
  @media (max-width:560px){ .vcard > div{grid-template-columns:1fr; gap:4px;} }
  .vcard dt{font-family:'IBM Plex Mono', monospace; font-size:11.5px; letter-spacing:0.1em; text-transform:uppercase; color:var(--white-dim); padding-top:3px;}
  .vcard dd{margin:0; color:var(--white); overflow-wrap:anywhere;}
  .vcard dd a, .v-more a{color:var(--gold-bright);}
  .v-name{font-family:'Fraunces', serif; font-size:22px; text-align:left;}
  .mono{font-family:'IBM Plex Mono', monospace;}
  .badge{display:inline-block; font-family:'IBM Plex Mono', monospace; font-size:13px; letter-spacing:0.08em; text-transform:uppercase; padding:4px 10px; border-radius:2px;}
  .badge.ok{color:var(--ok); border:1px solid var(--ok);}
  .badge.bad{color:var(--bad); border:1px solid var(--bad);}
  .v-more{margin:24px 0 0;}
  `;

  return pageShell({
    title: `Verify certificate ${cert.certificate_no} | MEDJAY`,
    noindex: true,
    bodyContent,
    extraCss,
  });
}
