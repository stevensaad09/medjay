// Cloudflare Pages Function
// Handles GET /articles/:slug
// Server-renders a single published article (matching the site's design
// system) with a comment form (protected by Turnstile) and the existing
// comment list. Returns 404 for missing or unpublished articles.

const TURNSTILE_SITE_KEY = '0x4AAAAAAEdGei9y6nHiNLdP';

export async function onRequestGet(context) {
  const { env, params } = context;
  const slug = params.slug;

  if (!env.DB) {
    return new Response('Server not configured.', { status: 500 });
  }

  let article;
  try {
    article = await env.DB.prepare(
      'SELECT id, slug, title, content, excerpt, created_at, updated_at FROM articles WHERE slug = ? AND published = 1'
    ).bind(slug).first();
  } catch (err) {
    return new Response('Something went wrong. Please try again.', { status: 500 });
  }

  if (!article) {
    return new Response(renderNotFoundPage(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=UTF-8' },
    });
  }

  let comments = [];
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, author_name, rating, comment_text, created_at FROM comments WHERE article_id = ? ORDER BY created_at DESC, id DESC'
    ).bind(article.id).all();
    comments = results || [];
  } catch (err) {
    comments = [];
  }

  return new Response(renderArticlePage(article, comments), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  });
}

function renderArticlePage(article, comments) {
  const title = escapeHtml(article.title);
  const description = escapeHtml(article.excerpt || stripMarkdown(article.content).slice(0, 160));
  const canonical = `https://medjay.pro/articles/${escapeHtml(article.slug)}`;
  const publishedDate = formatDate(article.created_at);
  const isoPublished = toIso(article.created_at);
  const isoUpdated = toIso(article.updated_at || article.created_at);

  const commentsHtml = comments.length
    ? comments.map(renderCommentCard).join('\n')
    : '<p class="comments-empty">No comments yet. Be the first to share your thoughts.</p>';

  const bodyContent = `
<main id="main">
<section class="hero">
  <div class="wrap">
    <span class="eyebrow reveal">Articles</span>
    <h1 class="reveal">${title}</h1>
    <div class="trust-line reveal">Published ${escapeHtml(publishedDate)}</div>
  </div>
</section>

<div class="watchline"></div>

<section id="article-body">
  <div class="wrap">
    <div class="article-body reveal">
      ${renderPlainTextContent(article.content)}
    </div>
  </div>
</section>

<div class="watchline"></div>

<section id="comments">
  <div class="wrap">
    <span class="eyebrow reveal">Join the Conversation</span>
    <h2 class="reveal" style="margin-top:16px;">Comments</h2>

    <form id="comment-form" class="customize-form reveal" style="margin-top:32px;" novalidate>
      <input type="hidden" id="comment-article-id" value="${article.id}">
      <div class="form-row">
        <div class="form-field">
          <label for="comment-name">Name</label>
          <input type="text" id="comment-name" name="author_name" required autocomplete="name">
        </div>
        <div class="form-field">
          <label>Rating</label>
          <div class="star-rating" role="radiogroup" aria-label="Rating out of 5 stars">
            <button type="button" class="star" data-value="1" aria-label="1 star">★</button>
            <button type="button" class="star" data-value="2" aria-label="2 stars">★</button>
            <button type="button" class="star" data-value="3" aria-label="3 stars">★</button>
            <button type="button" class="star" data-value="4" aria-label="4 stars">★</button>
            <button type="button" class="star" data-value="5" aria-label="5 stars">★</button>
          </div>
          <input type="hidden" id="comment-rating" name="rating" value="" required>
        </div>
      </div>
      <div class="form-field">
        <label for="comment-text">Comment</label>
        <textarea id="comment-text" name="comment_text" rows="4" required></textarea>
      </div>
      <div class="form-field">
        <div class="cf-turnstile" data-sitekey="${TURNSTILE_SITE_KEY}"></div>
      </div>
      <button type="submit" class="btn-primary">Post Comment</button>
      <p class="customize-status" id="comment-status" role="status" aria-live="polite"></p>
    </form>

    <div class="comments-list reveal" id="comments-list" style="margin-top:40px;">
      ${commentsHtml}
    </div>
  </div>
</section>
</main>`;

  const jsonLd = `
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://medjay.pro/#organization",
      "name": "MEDJAY",
      "url": "https://medjay.pro/",
      "logo": "https://medjay.pro/assets/icon-512.png",
      "description": "Psychology-driven sales training programs for SaaS and Real Estate organizations.",
      "founder": { "@id": "https://medjay.pro/#founder" },
      "address": { "@type": "PostalAddress", "addressLocality": "Sharjah", "addressCountry": "AE" },
      "email": "steven@medjay.pro"
    },
    {
      "@type": "Person",
      "@id": "https://medjay.pro/#founder",
      "name": "Steven Saad",
      "jobTitle": "Founder & Sales Psychology Trainer",
      "worksFor": { "@id": "https://medjay.pro/#organization" },
      "sameAs": ["https://linkedin.com/in/steven-saad"],
      "email": "steven@medjay.pro"
    },
    {
      "@type": "BlogPosting",
      "headline": ${JSON.stringify(article.title)},
      "description": ${JSON.stringify(article.excerpt || '')},
      "datePublished": "${isoPublished}",
      "dateModified": "${isoUpdated}",
      "author": { "@id": "https://medjay.pro/#founder" },
      "publisher": { "@id": "https://medjay.pro/#organization" },
      "mainEntityOfPage": "${canonical}"
    }
  ]
}`;

  const extraScript = `
  const commentForm = document.getElementById('comment-form');
  const commentStatus = document.getElementById('comment-status');
  const commentsList = document.getElementById('comments-list');
  const stars = document.querySelectorAll('.star-rating .star');
  const ratingInput = document.getElementById('comment-rating');

  function setRating(value){
    ratingInput.value = value;
    stars.forEach(function(star){
      star.classList.toggle('filled', parseInt(star.dataset.value, 10) <= value);
    });
  }
  stars.forEach(function(star){
    star.addEventListener('click', function(){
      setRating(parseInt(star.dataset.value, 10));
    });
  });

  function escapeHtml(str){
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function starGlyphs(rating){
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }
  function formatDate(iso){
    try{
      return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    } catch(err){ return iso; }
  }
  async function reloadComments(){
    try{
      const res = await fetch('/api/comments?article_id=' + encodeURIComponent(${article.id}));
      const data = await res.json().catch(function(){ return {}; });
      const items = data.comments || [];
      if(!items.length){
        commentsList.innerHTML = '<p class="comments-empty">No comments yet. Be the first to share your thoughts.</p>';
        return;
      }
      commentsList.innerHTML = items.map(function(c){
        return '<div class="comment-card">' +
          '<div class="comment-head">' +
            '<span class="comment-author">' + escapeHtml(c.author_name) + '</span>' +
            '<span class="comment-date">' + escapeHtml(formatDate(c.created_at)) + '</span>' +
          '</div>' +
          '<div class="comment-stars" aria-label="' + c.rating + ' out of 5 stars">' + starGlyphs(c.rating) + '</div>' +
          '<p class="comment-text">' + escapeHtml(c.comment_text) + '</p>' +
        '</div>';
      }).join('');
    } catch(err){ /* leave existing list as-is */ }
  }

  if(commentForm){
    commentForm.addEventListener('submit', async function(e){
      e.preventDefault();
      const submitBtn = commentForm.querySelector('button[type="submit"]');
      const turnstileInput = commentForm.querySelector('[name="cf-turnstile-response"]');
      const payload = {
        article_id: ${article.id},
        author_name: document.getElementById('comment-name').value.trim(),
        rating: parseInt(ratingInput.value, 10),
        comment_text: document.getElementById('comment-text').value.trim(),
        turnstile_token: turnstileInput ? turnstileInput.value : ''
      };
      if(!payload.author_name || !payload.comment_text || !(payload.rating >= 1 && payload.rating <= 5)){
        commentStatus.textContent = 'Please fill in your name, a rating, and a comment.';
        return;
      }
      if(!payload.turnstile_token){
        commentStatus.textContent = 'Please complete the verification challenge.';
        return;
      }
      submitBtn.disabled = true;
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Posting…';
      commentStatus.textContent = '';
      try{
        const res = await fetch('/api/comments', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(function(){ return {}; });
        if(res.ok){
          commentStatus.textContent = data.message || 'Thanks — your comment has been posted.';
          commentForm.reset();
          setRating(0);
          await reloadComments();
        } else {
          commentStatus.textContent = data.message || 'Something went wrong. Please try again.';
        }
      } catch(err){
        commentStatus.textContent = 'Network error. Please try again.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        if(window.turnstile){ window.turnstile.reset(); }
      }
    });
  }`;

  return pageShell({
    title: `${article.title} | MEDJAY`,
    description,
    canonical,
    jsonLd,
    bodyContent,
    extraScript,
    includeTurnstile: true,
  });
}

function renderCommentCard(c) {
  return `<div class="comment-card">
        <div class="comment-head">
          <span class="comment-author">${escapeHtml(c.author_name)}</span>
          <span class="comment-date">${escapeHtml(formatDate(c.created_at))}</span>
        </div>
        <div class="comment-stars" aria-label="${c.rating} out of 5 stars">${starGlyphs(c.rating)}</div>
        <p class="comment-text">${escapeHtml(c.comment_text)}</p>
      </div>`;
}

function renderNotFoundPage() {
  const bodyContent = `
<main id="main">
<section class="hero">
  <div class="wrap">
    <span class="eyebrow reveal">Articles</span>
    <h1 class="reveal">Article not found</h1>
    <p class="lede reveal">This article doesn't exist, or isn't published yet.</p>
    <div class="hero-ctas reveal">
      <a href="/articles" class="btn-primary">Back to Articles</a>
    </div>
  </div>
</section>
</main>`;

  return pageShell({
    title: 'Article Not Found | MEDJAY',
    description: 'This article does not exist, or is not published yet.',
    canonical: 'https://medjay.pro/articles',
    jsonLd: null,
    bodyContent,
    extraScript: '',
    includeTurnstile: false,
  });
}

function pageShell({ title, description, canonical, jsonLd, bodyContent, extraScript, includeTurnstile }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#0a1428">
<meta name="robots" content="index, follow">
<meta name="author" content="Steven Saad">

<meta property="og:type" content="article">
<meta property="og:site_name" content="MEDJAY">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="https://medjay.pro/assets/icon-512.png">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta property="og:locale" content="en_US">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="https://medjay.pro/assets/icon-512.png">

<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700;9..144,900&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
${includeTurnstile ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ''}
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
<style>
  :root{
    --navy: #0a1428;
    --navy-2: #101d34;
    --navy-3: #16233d;
    --white: #f7f4ec;
    --white-dim: #b7bccb;
    --gold: #c9a24b;
    --gold-bright: #e8c572;
    --sand: #c9bfae;
    --line: rgba(247,244,236,0.13);
    --maxw: 1120px;
  }
  *{box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  @media (prefers-reduced-motion: reduce){
    html{scroll-behavior:auto;}
    *{animation-duration:0.001ms !important; animation-iteration-count:1 !important; transition-duration:0.001ms !important;}
  }
  body{
    margin:0;
    background:var(--navy);
    color:var(--white);
    font-family:'Inter', sans-serif;
    font-size:16px;
    line-height:1.6;
    -webkit-font-smoothing:antialiased;
  }
  h1,h2,h3{
    font-family:'Fraunces', serif;
    font-weight:600;
    margin:0;
    color:var(--white);
    letter-spacing:-0.01em;
  }
  a{color:inherit;}
  .eyebrow{
    font-family:'IBM Plex Mono', monospace;
    font-size:12px;
    letter-spacing:0.18em;
    text-transform:uppercase;
    color:var(--gold);
  }
  .wrap{
    max-width:var(--maxw);
    margin:0 auto;
    padding:0 28px;
  }
  a:focus-visible, button:focus-visible{
    outline:2px solid var(--gold-bright);
    outline-offset:3px;
  }
  section{padding:78px 0;}

  .watchline{
    position:relative;
    height:1px;
    background:var(--line);
    width:100%;
  }
  .watchline::before{
    content:"";
    position:absolute;
    top:-3px; left:0;
    width:7px; height:7px;
    border-radius:50%;
    background:var(--gold-bright);
    box-shadow:0 0 8px rgba(232,197,114,0.6);
    animation:patrol 10s linear infinite;
  }
  @keyframes patrol{
    0%{left:0%;}
    50%{left:calc(100% - 7px);}
    100%{left:0%;}
  }

  header{
    position:sticky; top:0; z-index:40;
    background:rgba(10,20,40,0.9);
    backdrop-filter:blur(8px);
    border-bottom:1px solid var(--line);
  }
  nav.wrap{
    display:flex; align-items:center; justify-content:space-between;
    flex-wrap:wrap;
    min-height:76px;
    row-gap:10px;
    padding-top:14px; padding-bottom:14px;
  }
  .brandmark{
    display:flex; align-items:center; gap:10px;
    text-decoration:none;
  }
  .brandmark img{
    height:34px; width:auto; display:block;
  }
  .brandmark span{
    font-family:'Fraunces', serif;
    font-weight:700;
    font-size:19px;
    letter-spacing:0.08em;
    color:var(--white);
  }
  .navlinks{
    display:flex;
    flex-wrap:wrap;
    gap:10px 24px;
    list-style:none; margin:0; padding:0;
    order:3;
    flex-basis:100%;
    justify-content:center;
  }
  @media (min-width:780px){
    .navlinks{
      flex-basis:auto;
      order:0;
      justify-content:flex-start;
      gap:32px;
    }
  }
  @media (max-width:499px){
    .navlinks{gap:8px 16px;}
    .navlinks a{font-size:13px;}
  }
  .navlinks a{
    text-decoration:none;
    font-size:14px;
    color:var(--white-dim);
    transition:color .2s;
  }
  .navlinks a:hover{color:var(--white);}
  .nav-cta{
    font-size:14px;
    text-decoration:none;
    background:var(--gold);
    color:var(--navy);
    font-weight:600;
    padding:10px 18px;
    border-radius:2px;
    transition:background .2s;
    white-space:nowrap;
  }
  .nav-cta:hover{background:var(--gold-bright);}

  .hero{
    padding:88px 0 80px;
    position:relative;
    overflow:hidden;
  }
  .hero::after{
    content:"";
    position:absolute;
    right:-12%; top:-25%;
    width:600px; height:600px;
    background:radial-gradient(circle, rgba(201,162,75,0.10), transparent 68%);
    pointer-events:none;
  }
  .hero .eyebrow{margin-bottom:22px; display:block;}
  .hero h1{
    font-size:clamp(32px, 5vw, 54px);
    line-height:1.12;
    max-width:820px;
  }
  .hero p.lede{
    max-width:560px;
    font-size:18px;
    color:var(--white-dim);
    margin:26px 0 36px;
  }
  .hero-ctas{display:flex; gap:16px; flex-wrap:wrap; margin-bottom:48px;}
  .btn-primary{
    font-family:'Inter';
    font-weight:600;
    font-size:15px;
    text-decoration:none;
    background:var(--gold);
    color:var(--navy);
    padding:14px 26px;
    border-radius:2px;
    border:1px solid var(--gold);
    transition:background .2s, transform .2s;
    display:inline-block;
    cursor:pointer;
  }
  .btn-primary:hover{background:var(--gold-bright); transform:translateY(-1px);}
  .trust-line{
    font-family:'IBM Plex Mono', monospace;
    font-size:12.5px;
    color:var(--white-dim);
    letter-spacing:0.02em;
  }

  .article-body{
    max-width:720px;
    color:var(--white-dim);
    font-size:17px;
    line-height:1.75;
  }
  .article-body h2{color:var(--white); font-size:28px; margin:44px 0 16px;}
  .article-body h3{color:var(--white); font-size:22px; margin:36px 0 14px;}
  .article-body p{margin:0 0 20px;}
  .article-body a{color:var(--gold-bright);}
  .article-body ul, .article-body ol{margin:0 0 20px; padding-left:22px;}
  .article-body li{margin-bottom:8px;}
  .article-body blockquote{
    border-left:2px solid var(--gold);
    padding-left:18px;
    margin:28px 0;
    font-family:'Fraunces', serif;
    font-style:italic;
    color:var(--white);
    font-size:19px;
  }
  .article-body strong{color:var(--white);}
  .article-body img{max-width:100%; border-radius:4px; margin:20px 0; display:block;}

  .customize-form{
    max-width:640px;
    border:1px solid rgba(201,162,75,0.3);
    background:linear-gradient(160deg, var(--navy-3), var(--navy));
    padding:40px 36px;
    border-radius:4px;
  }
  .form-row{
    display:grid; grid-template-columns:1fr; gap:20px;
    margin-bottom:20px;
  }
  @media (min-width:560px){ .form-row{grid-template-columns:1fr 1fr;} }
  .form-field{margin-bottom:20px;}
  .form-row .form-field{margin-bottom:0;}
  .form-field label{
    display:block;
    font-family:'IBM Plex Mono', monospace;
    font-size:11.5px;
    letter-spacing:0.08em;
    text-transform:uppercase;
    color:var(--white-dim);
    margin-bottom:8px;
  }
  .form-field input,
  .form-field textarea{
    width:100%;
    background:var(--navy);
    border:1px solid var(--line);
    color:var(--white);
    font-family:'Inter', sans-serif;
    font-size:15px;
    padding:13px 14px;
    border-radius:2px;
  }
  .form-field textarea{resize:vertical; min-height:110px;}
  .form-field input:focus-visible,
  .form-field textarea:focus-visible{
    outline:2px solid var(--gold-bright);
    outline-offset:2px;
  }
  .star-rating{display:flex; gap:4px;}
  .star-rating .star{
    background:none; border:none; cursor:pointer; padding:2px;
    font-size:26px; line-height:1; color:var(--white-dim);
    transition:color .15s;
  }
  .star-rating .star.filled{color:var(--gold);}
  .customize-form button[type="submit"]{
    cursor:pointer;
    border:1px solid var(--gold);
  }
  .customize-status{
    font-family:'IBM Plex Mono', monospace;
    font-size:13px;
    color:var(--gold-bright);
    margin:16px 0 0;
    min-height:18px;
  }

  .comments-list{
    display:flex; flex-direction:column; gap:1px;
    background:var(--line); border:1px solid var(--line);
  }
  .comment-card{background:var(--navy); padding:22px 24px;}
  .comment-head{
    display:flex; justify-content:space-between; align-items:baseline;
    flex-wrap:wrap; gap:8px; margin-bottom:6px;
  }
  .comment-author{font-family:'Fraunces', serif; font-weight:600; color:var(--white); font-size:15px;}
  .comment-date{font-family:'IBM Plex Mono', monospace; font-size:11.5px; color:var(--white-dim);}
  .comment-stars{color:var(--gold); letter-spacing:2px; font-size:14px; margin-bottom:8px;}
  .comment-text{color:var(--white-dim); font-size:14.5px; line-height:1.6; margin:0;}
  .comments-empty{color:var(--white-dim); font-size:15px; font-style:italic;}

  footer{
    border-top:1px solid var(--line);
    padding:44px 0 36px;
  }
  .footer-grid{
    display:flex; flex-wrap:wrap; justify-content:space-between; gap:24px;
    margin-bottom:28px;
  }
  .footer-col h4{
    font-family:'IBM Plex Mono', monospace;
    font-size:11px; letter-spacing:0.1em; text-transform:uppercase;
    color:var(--gold); margin-bottom:12px;
  }
  .footer-col a, .footer-col p{
    display:block;
    color:var(--white-dim);
    text-decoration:none;
    font-size:14px;
    margin-bottom:8px;
  }
  .footer-col a:hover{color:var(--white);}
  .footer-bottom{
    font-size:12.5px;
    color:var(--white-dim);
    display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;
  }

  .reveal{
    opacity:0;
    transform:translateY(14px);
    transition:opacity .7s ease, transform .7s ease;
  }
  .reveal.in{opacity:1; transform:translateY(0);}

  .skip-link{
    position:absolute;
    left:-9999px;
    top:0;
    background:var(--gold);
    color:var(--navy);
    font-family:'Inter', sans-serif;
    font-weight:600;
    font-size:14px;
    padding:12px 20px;
    z-index:100;
    border-radius:0 0 4px 0;
    text-decoration:none;
  }
  .skip-link:focus{
    left:0;
  }
</style>
</head>
<body>
<a href="#main" class="skip-link">Skip to main content</a>

<header>
  <nav class="wrap" aria-label="Primary">
    <a href="/" class="brandmark" aria-label="MEDJAY — home">
      <img src="/assets/medjay-mark-nav.png" alt="" width="48" height="42" fetchpriority="high">
      <span>MEDJAY</span>
    </a>
    <ul class="navlinks">
      <li><a href="/">Home</a></li>
      <li><a href="/books">Books</a></li>
      <li><a href="/info/stevensaad">Info</a></li>
      <li><a href="/programs">Programs</a></li>
      <li><a href="/articles">Articles</a></li>
      <li><a href="/#contact">Contact Us</a></li>
    </ul>
    <a class="nav-cta" href="/#contact">Book a Discovery Call</a>
  </nav>
</header>

<div class="watchline" role="presentation"></div>
${bodyContent}
<div class="watchline"></div>

<footer>
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-col">
        <h4>Medjay</h4>
        <p>Sales psychology, applied.</p>
      </div>
      <div class="footer-col">
        <h4>Programs</h4>
        <a href="/programs/saas">SaaS Revenue Academy</a>
        <a href="/programs/usa-real-estate">Real Estate Neuro-Sales — Individual</a>
        <a href="/programs/usa-real-estate-enterprise">Real Estate Neuro-Sales — Enterprise</a>
      </div>
      <div class="footer-col">
        <h4>Contact</h4>
        <a href="mailto:steven@medjay.pro">steven@medjay.pro</a>
        <a href="https://linkedin.com/in/steven-saad" target="_blank" rel="noopener" aria-label="Steven Saad on LinkedIn (opens in new tab)">LinkedIn — Steven Saad</a>
      </div>
      <div class="footer-col">
        <h4>Location</h4>
        <p>Sharjah, UAE</p>
      </div>
    </div>
    <div class="watchline" style="margin-bottom:22px;"></div>
    <div class="footer-bottom">
      <span>© 2026 MEDJAY. All rights reserved.</span>
    </div>
  </div>
</footer>

<script>
  const revealEls = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, {threshold:0.12});
  revealEls.forEach(el=>io.observe(el));
${extraScript}
</script>

</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripMarkdown(str) {
  return String(str).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\s+/g, ' ').trim();
}

// Converts the article's stored plain text (blank lines separate
// paragraphs, **text** is bold) into HTML at render time. The raw
// text is escaped first so the only markup this ever produces is the
// <p>/<strong>/<br> it adds itself.
function renderPlainTextContent(raw) {
  const escaped = escapeHtml(raw || '');
  const paragraphs = escaped
    .split(/\n\s*\n+/)
    .map(function (block) { return block.trim(); })
    .filter(function (block) { return block.length > 0; });

  if (!paragraphs.length) return '';

  return paragraphs
    .map(function (block) {
      const withBold = block.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      const withBreaks = withBold.replace(/\n/g, '<br>');
      return '<p>' + withBreaks + '</p>';
    })
    .join('\n      ');
}

function starGlyphs(rating) {
  const n = Math.max(0, Math.min(5, parseInt(rating, 10) || 0));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function formatDate(value) {
  try {
    const d = new Date(/\s/.test(value) && !value.includes('T') ? value.replace(' ', 'T') + 'Z' : value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (err) {
    return String(value);
  }
}

function toIso(value) {
  try {
    const d = new Date(/\s/.test(value) && !value.includes('T') ? value.replace(' ', 'T') + 'Z' : value);
    if (isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
  } catch (err) {
    return new Date().toISOString();
  }
}
