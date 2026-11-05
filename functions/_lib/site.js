// Shared page shell for server-rendered exam, certificate and verify
// pages: same navy/gold design, fonts, header and footer as the static
// site. Not a route: exports no onRequest handlers.

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// noindex sends "noindex, nofollow". `robots` overrides it with an exact
// X-Robots-Tag value (for example "noindex, follow" on exam pages).
export function htmlResponse(html, status = 200, { noindex = false, robots = '', cache = 'no-store' } = {}) {
  const headers = { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': cache };
  if (robots) headers['X-Robots-Tag'] = robots;
  else if (noindex) headers['X-Robots-Tag'] = 'noindex, nofollow';
  return new Response(html, { status, headers });
}

const BASE_CSS = `
  :root{
    --navy:#0a1428; --navy-2:#101d34; --navy-3:#16233d;
    --white:#f7f4ec; --white-dim:#b7bccb;
    --gold:#c9a24b; --gold-bright:#e8c572;
    --line:rgba(247,244,236,0.13); --maxw:1120px;
    --ok:#7fc79a; --bad:#e58b7b;
  }
  *{box-sizing:border-box;}
  body{margin:0; background:var(--navy); color:var(--white); font-family:'Inter', sans-serif; font-size:16px; line-height:1.6; -webkit-font-smoothing:antialiased;}
  h1,h2,h3{font-family:'Fraunces', serif; font-weight:600; margin:0; color:var(--white); letter-spacing:-0.01em;}
  a{color:inherit;}
  a:focus-visible, button:focus-visible, input:focus-visible{outline:2px solid var(--gold-bright); outline-offset:3px;}
  .wrap{max-width:var(--maxw); margin:0 auto; padding:0 28px;}
  @media (max-width:499px){ .wrap{padding:0 16px;} }
  .eyebrow{font-family:'IBM Plex Mono', monospace; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:var(--gold);}
  .watchline{height:1px; background:var(--line); width:100%;}
  .skip-link{position:absolute; left:-9999px; top:0; background:var(--gold); color:var(--navy); padding:10px 14px; z-index:100;}
  .skip-link:focus{left:12px; top:12px;}
  header{position:sticky; top:0; z-index:40; background:rgba(10,20,40,0.92); backdrop-filter:blur(8px); border-bottom:1px solid var(--line);}
  nav.wrap{display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; min-height:76px; row-gap:10px; padding-top:14px; padding-bottom:14px;}
  .brandmark{display:flex; align-items:center; gap:10px; text-decoration:none;}
  .brandmark img{height:34px; width:auto; display:block;}
  .brandmark span{font-family:'Fraunces', serif; font-weight:700; font-size:19px; letter-spacing:0.08em; color:var(--white);}
  .navlinks{display:flex; flex-wrap:wrap; gap:10px 24px; list-style:none; margin:0; padding:0; order:3; flex-basis:100%; justify-content:center;}
  @media (min-width:780px){ .navlinks{flex-basis:auto; order:0; justify-content:flex-start; gap:32px;} }
  @media (max-width:499px){ .navlinks{gap:8px 16px;} .navlinks a{font-size:13px;} }
  .navlinks a{text-decoration:none; font-size:14px; color:var(--white-dim);}
  .navlinks a:hover{color:var(--white);}
  .nav-cta{font-size:14px; text-decoration:none; background:var(--gold); color:var(--navy); font-weight:600; padding:10px 18px; border-radius:2px; white-space:nowrap;}
  .nav-cta:hover{background:var(--gold-bright);}
  section{padding:64px 0;}
  .hero{padding:72px 0 56px;}
  .hero .eyebrow{margin-bottom:18px; display:block;}
  .hero h1{font-size:clamp(30px, 5vw, 50px); line-height:1.12; max-width:820px;}
  .lede{max-width:640px; font-size:18px; color:var(--white-dim); margin:22px 0 0;}
  .btn-primary, .btn-ghost{font-family:'Inter', sans-serif; font-weight:600; font-size:15px; text-decoration:none; padding:14px 26px; border-radius:2px; display:inline-block; cursor:pointer; line-height:1.2;}
  .btn-primary{background:var(--gold); color:var(--navy); border:1px solid var(--gold);}
  .btn-primary:hover{background:var(--gold-bright);}
  .btn-primary[disabled]{opacity:.6; cursor:wait;}
  .btn-ghost{background:transparent; color:var(--white); border:1px solid var(--line);}
  .btn-ghost:hover{border-color:var(--gold);}
  footer{border-top:1px solid var(--line); padding:40px 0 32px;}
  .footer-bottom{font-size:12.5px; color:var(--white-dim); display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;}
  .footer-bottom a{color:inherit;}
`;

export function pageShell({ title, description = '', bodyContent, extraCss = '', extraHead = '', extraScript = '', noindex = false, robots = '', canonical = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
${description ? `<meta name="description" content="${escapeHtml(description)}">` : ''}
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ''}
<meta name="theme-color" content="#0a1428">
<meta name="robots" content="${robots || (noindex ? 'noindex, nofollow' : 'index, follow')}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/fonts.css">
${extraHead}
<style>${BASE_CSS}${extraCss}</style>
</head>
<body>
<a href="#main" class="skip-link">Skip to main content</a>
<header class="site-header">
<nav class="wrap" aria-label="Primary">
<a href="/" class="brandmark" aria-label="MEDJAY home">
<img src="/assets/medjay-mark-nav.png" alt="" width="48" height="42">
<span>MEDJAY</span>
</a>
<ul class="navlinks">
<li><a href="/">Home</a></li>
<li><a href="/books">Books</a></li>
<li><a href="/info/stevensaad">Info</a></li>
<li><a href="/programs">Programs</a></li>
<li><a href="/courses/">Free Courses</a></li>
<li><a href="/articles">Articles</a></li>
<li><a href="/#contact">Contact Us</a></li>
</ul>
<a class="nav-cta" href="/#contact">Book a Discovery Call</a>
</nav>
</header>
<div class="watchline site-line" role="presentation"></div>
${bodyContent}
<footer class="site-footer">
<div class="wrap">
<div class="footer-bottom">
<span>© ${new Date().getUTCFullYear()} MEDJAY. All rights reserved.</span>
<a href="/privacy/">Privacy Policy</a>
</div>
</div>
</footer>
${extraScript}
</body>
</html>`;
}

// Shared "not found" page for /certificate/* and /verify/* (noindex).
export function certNotFoundPage() {
  return pageShell({
    title: 'Certificate Not Found | MEDJAY',
    noindex: true,
    bodyContent: `
<main id="main">
<section class="hero">
  <div class="wrap">
    <span class="eyebrow">Certificate verification</span>
    <h1>Certificate not found</h1>
    <p class="lede">We could not find a MEDJAY certificate with this number. Check that it was typed exactly as printed, for example MJ-RSE-2026-7K4Q9X.</p>
    <p style="margin-top:28px;"><a href="/courses/" class="btn-primary">Browse free courses</a></p>
  </div>
</section>
</main>`,
  });
}
