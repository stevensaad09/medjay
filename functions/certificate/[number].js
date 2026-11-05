// Cloudflare Pages Function
// Handles GET /certificate/:number
//
// Public certificate page (landscape A4, navy/gold). Shows the same
// public data as /verify/:number: full name, course, issue date and
// number. Never the email, never the score. "Download PDF" opens the
// browser's print dialog; the print stylesheet lays the certificate out
// on one A4 landscape page. noindex (meta + X-Robots-Tag).

import { getExam, isCertificateNo, formatIssueDate, linkedInAddUrl } from '../_lib/exam.js';
import { getCertificate } from '../_lib/exam-db.js';
import { escapeHtml, pageShell, htmlResponse, certNotFoundPage as notFoundPage } from '../_lib/site.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const raw = String(params.number || '');
  const number = raw.toUpperCase();

  if (!isCertificateNo(number)) return htmlResponse(notFoundPage(), 404, { noindex: true });
  if (number !== raw) {
    return new Response(null, { status: 301, headers: { Location: `/certificate/${number}`, 'X-Robots-Tag': 'noindex, nofollow' } });
  }
  if (!env.DB) return htmlResponse('Server not configured.', 500, { noindex: true });

  let cert;
  try {
    cert = await getCertificate(env.DB, number);
  } catch (err) {
    return htmlResponse('Something went wrong. Please try again.', 500, { noindex: true });
  }
  const exam = cert && getExam(cert.course_slug);
  if (!cert || !exam) return htmlResponse(notFoundPage(), 404, { noindex: true });

  if (Number(cert.revoked) === 1) return htmlResponse(revokedPage(number), 200, { noindex: true });

  return htmlResponse(renderCertificate(cert, exam), 200, { noindex: true });
}

function renderCertificate(cert, exam) {
  const name = escapeHtml(cert.full_name);
  const nameClass = cert.full_name.length > 48 ? 'xl' : cert.full_name.length > 32 ? 'l' : '';
  const course = escapeHtml(exam.title);
  const issued = escapeHtml(formatIssueDate(cert.issued_at));
  const no = escapeHtml(cert.certificate_no);
  const linkedIn = escapeHtml(linkedInAddUrl({ courseTitle: exam.title, certNo: cert.certificate_no, issuedAt: cert.issued_at }));
  const verifyHref = escapeHtml(`/verify/${cert.certificate_no}`);

  const bodyContent = `
<main id="main">
<section class="cert-section">
  <div class="wrap">
    <div class="toolbar">
      <div>
        <span class="eyebrow">Certificate</span>
        <p class="tb-note">Use "Download PDF", then choose "Save as PDF" as the printer.</p>
      </div>
      <div class="tb-btns">
        <button type="button" class="btn-primary" onclick="window.print()">Download PDF</button>
        <a class="btn-ghost" href="${linkedIn}" target="_blank" rel="noopener">Add to LinkedIn profile</a>
        <a class="btn-ghost" href="${verifyHref}">Verify</a>
      </div>
    </div>

    <article class="sheet" aria-label="Certificate of Completion">
      <div class="frame">
        <div class="inner">
          <div class="brand">
            <img src="/assets/medjay-mark-nav.png" alt="MEDJAY logo" width="110" height="96">
            <span class="wordmark">MEDJAY</span>
          </div>
          <h1 class="c-title">Certificate of Completion</h1>
          <div class="rule"></div>
          <p class="c-name ${nameClass}" dir="auto">${name}</p>
          <p class="c-text">has successfully completed</p>
          <p class="c-course">${course} — Level 1</p>
          <p class="c-meta">Issued: ${issued} · Certificate No: ${no}</p>
          <p class="c-verify">Verify at medjay.pro/verify/${no}</p>
          <div class="sig">
            <div class="sig-line"></div>
            <p class="sig-name">Steven Saad, Founder, MEDJAY</p>
          </div>
        </div>
      </div>
    </article>
  </div>
</section>
</main>`;

  const extraCss = `
  .cert-section{padding:40px 0 64px;}
  .toolbar{display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:16px; margin-bottom:24px;}
  .tb-note{color:var(--white-dim); font-size:14px; margin:6px 0 0;}
  .tb-btns{display:flex; gap:10px; flex-wrap:wrap;}
  .sheet{
    container-type:inline-size;
    width:100%; max-width:1100px; margin:0 auto;
    aspect-ratio:297 / 210;
    background:radial-gradient(ellipse at 50% 0%, #16264a 0%, var(--navy) 70%);
    color:var(--white);
    box-shadow:0 20px 60px rgba(0,0,0,0.45);
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }
  .frame{position:absolute; inset:0;}
  .sheet{position:relative;}
  .frame{margin:2.6cqw; border:0.25cqw solid var(--gold); padding:0.7cqw;}
  .inner{height:100%; border:0.1cqw solid rgba(201,162,75,0.6); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:2cqw 6cqw;}
  .brand{display:flex; flex-direction:column; align-items:center; gap:0.6cqw; margin-bottom:1.6cqw;}
  .brand img{width:6.2cqw; height:auto;}
  .wordmark{font-family:'Fraunces', serif; font-weight:700; letter-spacing:0.3em; font-size:1.7cqw; color:var(--gold-bright); padding-left:0.3em;}
  .c-title{font-family:'IBM Plex Mono', monospace; font-weight:500; text-transform:uppercase; letter-spacing:0.28em; font-size:1.9cqw; color:var(--gold); margin:0;}
  .rule{width:12cqw; height:0.12cqw; background:var(--gold); margin:2.2cqw 0 2.4cqw;}
  .c-name{font-family:'Fraunces', serif; font-weight:600; font-size:5.2cqw; line-height:1.15; color:var(--white); margin:0; max-width:100%; overflow-wrap:anywhere;}
  .c-name.l{font-size:4.1cqw;}
  .c-name.xl{font-size:3.2cqw;}
  .c-text{font-size:1.6cqw; color:var(--white-dim); margin:1.6cqw 0 1cqw; font-style:italic;}
  .c-course{font-family:'Fraunces', serif; font-size:2.8cqw; color:var(--gold-bright); margin:0;}
  .c-meta{font-family:'IBM Plex Mono', monospace; font-size:1.15cqw; color:var(--white-dim); margin:3cqw 0 0.5cqw; letter-spacing:0.04em;}
  .c-verify{font-family:'IBM Plex Mono', monospace; font-size:1.05cqw; color:var(--white-dim); margin:0;}
  .sig{margin-top:2.6cqw; display:flex; flex-direction:column; align-items:center;}
  .sig-line{width:22cqw; height:0.1cqw; background:var(--white-dim);}
  .sig-name{font-size:1.3cqw; color:var(--white); margin:0.8cqw 0 0;}

  @page{size:A4 landscape; margin:0;}
  @media print{
    html, body{background:var(--navy); margin:0; padding:0;}
    .site-header, .site-line, .site-footer, .toolbar, .skip-link{display:none !important;}
    .cert-section{padding:0;}
    .cert-section .wrap{padding:0; max-width:none;}
    .sheet{width:297mm; height:210mm; max-width:none; aspect-ratio:auto; box-shadow:none; margin:0; page-break-inside:avoid; break-inside:avoid;}
  }
  `;

  return pageShell({
    title: `${cert.full_name} · ${exam.title} Certificate | MEDJAY`,
    noindex: true,
    bodyContent,
    extraCss,
  });
}

function revokedPage(number) {
  return pageShell({
    title: 'Certificate Revoked | MEDJAY',
    noindex: true,
    bodyContent: `
<main id="main">
<section class="hero">
  <div class="wrap">
    <span class="eyebrow">Certificate</span>
    <h1>This certificate has been revoked</h1>
    <p class="lede">Certificate No ${escapeHtml(number)} is no longer valid. See its <a style="color:var(--gold-bright);" href="/verify/${escapeHtml(number)}">verification page</a> for its status.</p>
  </div>
</section>
</main>`,
  });
}
