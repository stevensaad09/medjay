// Cloudflare Pages Function
// Handles GET /exam/:slug
//
// Server-renders the Level 1 or Level 2 exam for one course from
// functions/_data/exam-questions.json (questions and options only; the
// answer key lives in D1 and never reaches the browser). Questions and
// options keep the JSON order. The page script:
//   1. requires all questions answered + Turnstile, POSTs /api/exam/submit
//      (Level 2 also sends the access code; the server checks it);
//   2. failed: shows the score only, an encouragement line and Retake;
//   3. passed: asks for full name + email, previews the name exactly as
//      it will be printed, then POSTs /api/exam/claim and opens the
//      certificate page.
// The submit response is score-only for both levels: it never says which
// questions were wrong or what the correct letters are.

import { getExam, NAME_MIN, NAME_MAX, levelOf } from '../_lib/exam.js';
import { escapeHtml, pageShell, htmlResponse } from '../_lib/site.js';
import { siteKeyFor } from '../_lib/turnstile.js';

export async function onRequestGet(context) {
  const { request, params } = context;
  const exam = getExam(params.slug);
  if (!exam) return htmlResponse(renderNotFound(), 404, { noindex: true });
  return htmlResponse(renderExam(exam, siteKeyFor(request)), 200, { robots: 'noindex, follow', cache: 'public, max-age=300' });
}

function stemHtml(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function renderQuestion(q) {
  const opts = Object.entries(q.options).map(([letter, text]) => `
      <label class="opt">
        <input type="radio" name="q${q.no}" value="${escapeHtml(letter)}" required>
        <span class="opt-letter">${escapeHtml(letter)}</span>
        <span class="opt-text">${escapeHtml(text)}</span>
      </label>`).join('');
  return `
    <fieldset class="question" id="q${q.no}">
      <legend><span class="q-no">Question ${q.no}</span></legend>
      <p class="stem">${stemHtml(q.stem)}</p>
      <div class="opts">${opts}</div>
    </fieldset>`;
}

function renderExam(exam, siteKey) {
  const total = exam.questions.length;
  const passMark = exam.pass_mark;
  const level = levelOf(exam);
  const isPaid = level === 2;
  const title = `${exam.title} Level ${level} Exam | MEDJAY`;
  const lede = isPaid
    ? `${total} multiple-choice questions, one correct answer each. Pass with ${passMark} out of ${total} or more and you can claim your MEDJAY certificate. Enter the access code from your purchase below. No time limit, and you can retake it as often as you like with the same code.`
    : `${total} multiple-choice questions, one correct answer each. Pass with ${passMark} out of ${total} or more and you can claim your free MEDJAY certificate. No time limit, and you can retake it as often as you like.`;

  const bodyContent = `
<main id="main">
<section class="hero">
  <div class="wrap">
    <span class="eyebrow">${isPaid ? 'Paid course · Level 2 exam' : 'Free course · Level 1 exam'}</span>
    <h1>${escapeHtml(exam.title)}: Level ${level} Exam</h1>
    <p class="lede">${lede}</p>
    ${isPaid ? '' : `<p class="lede small"><a href="/courses/${escapeHtml(exam.slug)}/">Back to the course</a></p>`}
  </div>
</section>
<div class="watchline"></div>

<section id="exam-section">
  <div class="wrap narrow">
    ${isPaid ? `
    <div class="field">
      <label for="access-code">Access code (from your purchase)</label>
      <input id="access-code" name="access_code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="20" required>
      <p class="note">One code per course. It is tied to the email you claim the certificate with.</p>
    </div>` : ''}
    <form id="exam-form" novalidate>
      ${exam.questions.map(renderQuestion).join('')}
      <div class="submit-box">
        <p class="progress" id="progress" aria-live="polite">Answered 0 of ${total}</p>
        <div class="cf-turnstile" data-sitekey="${escapeHtml(siteKey)}"></div>
        <button type="submit" class="btn-primary" id="submit-btn">Submit answers</button>
        <p class="status" id="exam-status" role="alert"></p>
      </div>
    </form>

    <div id="result-fail" class="panel" hidden tabindex="-1">
      <span class="eyebrow">Your result</span>
      <p class="score"><span id="fail-score"></span> / ${total}</p>
      <p>You need ${passMark} to pass. You're closer than you think: review the course days and try again. There is no limit on retakes.</p>
      <button type="button" class="btn-primary" id="retake-btn">Retake the exam</button>
    </div>

    <div id="result-pass" class="panel" hidden tabindex="-1">
      <span class="eyebrow">You passed</span>
      <p class="score"><span id="pass-score"></span> / ${total}</p>
      <p>Well done. Enter your details to claim your ${isPaid ? '' : 'free '}certificate.</p>

      <form id="claim-form" novalidate>
        <div class="field">
          <label for="full_name">Full name (as it should appear on the certificate)</label>
          <input id="full_name" name="full_name" type="text" autocomplete="name" dir="auto" minlength="${NAME_MIN}" maxlength="${NAME_MAX}" required>
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="email" maxlength="254" required>
        </div>
        <label class="check">
          <input type="checkbox" id="updates" name="updates">
          <span>Send me MEDJAY updates and new courses</span>
        </label>
        <button type="submit" class="btn-primary">Continue</button>
        <p class="status" id="claim-status" role="alert"></p>
        <p class="note">We use your name and email to issue and send your certificate. Your name and the course are shown publicly on the certificate's verification page; your email is never shown. See our <a href="/privacy/">Privacy Policy</a>.</p>
      </form>

      <div id="confirm-box" hidden>
        <p>Your certificate will read:</p>
        <p class="name-preview" id="name-preview" dir="auto"></p>
        <p class="note">Check spelling and capitals carefully. Once issued, one certificate is kept per course and email.</p>
        <div class="btn-row">
          <button type="button" class="btn-primary" id="confirm-btn">Confirm and get my certificate</button>
          <button type="button" class="btn-ghost" id="edit-btn">Edit</button>
        </div>
        <p class="status" id="confirm-status" role="alert"></p>
      </div>
    </div>
  </div>
</section>
</main>`;

  const extraCss = `
  .narrow{max-width:800px;}
  .lede.small{font-size:15px; margin-top:14px;}
  .lede a, .note a{color:var(--gold-bright);}
  .question{border:1px solid var(--line); background:var(--navy-2); border-radius:4px; padding:22px 22px 16px; margin:0 0 18px;}
  .question legend{padding:0 6px;}
  .q-no{font-family:'IBM Plex Mono', monospace; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:var(--gold);}
  .stem{margin:4px 0 16px; font-size:16.5px;}
  .opts{display:flex; flex-direction:column; gap:8px;}
  .opt{display:flex; gap:12px; align-items:flex-start; padding:12px 14px; border:1px solid var(--line); border-radius:3px; cursor:pointer; color:var(--white-dim);}
  .opt:hover{border-color:rgba(201,162,75,0.5);}
  .opt input{margin-top:5px; accent-color:var(--gold);}
  .opt:has(input:checked){border-color:var(--gold); color:var(--white); background:rgba(201,162,75,0.08);}
  .opt-letter{font-family:'IBM Plex Mono', monospace; color:var(--gold); min-width:14px;}
  .question.missing{border-color:var(--bad);}
  .submit-box{margin-top:28px; display:flex; flex-direction:column; gap:16px; align-items:flex-start;}
  .progress{font-family:'IBM Plex Mono', monospace; font-size:13px; color:var(--white-dim); margin:0;}
  .status{font-family:'IBM Plex Mono', monospace; font-size:13px; color:var(--gold-bright); margin:0; min-height:18px;}
  .panel{border:1px solid rgba(201,162,75,0.35); background:linear-gradient(160deg, var(--navy-3), var(--navy)); border-radius:4px; padding:32px 28px;}
  .panel:focus{outline:none;}
  .score{font-family:'Fraunces', serif; font-size:48px; margin:6px 0 10px; color:var(--gold-bright);}
  .field{margin:0 0 18px;}
  .field label{display:block; font-family:'IBM Plex Mono', monospace; font-size:11.5px; letter-spacing:0.08em; text-transform:uppercase; color:var(--white-dim); margin-bottom:8px;}
  .field input{width:100%; background:var(--navy); border:1px solid var(--line); color:var(--white); font-family:'Inter', sans-serif; font-size:16px; padding:13px 14px; border-radius:2px;}
  .check{display:flex; gap:10px; align-items:flex-start; margin:0 0 20px; color:var(--white-dim); font-size:15px; cursor:pointer;}
  .check input{margin-top:4px; accent-color:var(--gold);}
  .note{font-size:13.5px; color:var(--white-dim); margin:16px 0 0;}
  .name-preview{text-align:left; font-family:'Fraunces', serif; font-size:clamp(26px, 5vw, 38px); color:var(--white); border-bottom:1px solid var(--gold); padding:8px 0 10px; margin:6px 0 4px; word-break:break-word;}
  .btn-row{display:flex; gap:12px; flex-wrap:wrap; margin-top:20px;}
  `;

  const extraScript = `
<script>
(function(){
  var COURSE = ${JSON.stringify(exam.slug)};
  var TOTAL = ${total};
  var IS_PAID = ${isPaid};
  var accessCodeInput = document.getElementById('access-code');
  var accessCode = '';
  var form = document.getElementById('exam-form');
  var progress = document.getElementById('progress');
  var examStatus = document.getElementById('exam-status');
  var submitBtn = document.getElementById('submit-btn');
  var failPanel = document.getElementById('result-fail');
  var passPanel = document.getElementById('result-pass');
  var attemptId = null;

  function answered(){
    var n = 0;
    for (var i = 1; i <= TOTAL; i++) if (form.querySelector('input[name="q' + i + '"]:checked')) n++;
    return n;
  }
  form.addEventListener('change', function(e){
    progress.textContent = 'Answered ' + answered() + ' of ' + TOTAL;
    var fs = e.target.closest('.question');
    if (fs) fs.classList.remove('missing');
  });

  function resetTurnstile(){ if (window.turnstile) { try { window.turnstile.reset(); } catch (e) {} } }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    examStatus.textContent = '';
    var letters = '';
    var firstMissing = null;
    for (var i = 1; i <= TOTAL; i++) {
      var c = form.querySelector('input[name="q' + i + '"]:checked');
      var fs = document.getElementById('q' + i);
      if (!c) { fs.classList.add('missing'); if (!firstMissing) firstMissing = fs; }
      letters += c ? c.value : '';
    }
    if (firstMissing) {
      examStatus.textContent = 'Please answer all ' + TOTAL + ' questions. Unanswered questions are outlined.';
      firstMissing.scrollIntoView({behavior:'smooth', block:'center'});
      return;
    }
    if (IS_PAID) {
      accessCode = accessCodeInput ? accessCodeInput.value.trim() : '';
      if (!accessCode) { examStatus.textContent = 'Enter the access code from your purchase.'; if (accessCodeInput) accessCodeInput.focus(); return; }
    }
    var tokenEl = form.querySelector('[name="cf-turnstile-response"]');
    var token = tokenEl ? tokenEl.value : '';
    if (!token) { examStatus.textContent = 'Please complete the verification check above the button.'; return; }

    submitBtn.disabled = true;
    examStatus.textContent = 'Checking your answers...';
    fetch('/api/exam/submit', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({course: COURSE, answers: letters, turnstile_token: token, access_code: accessCode})
    }).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ return {ok: r.ok, d: d}; }); })
    .then(function(res){
      submitBtn.disabled = false;
      resetTurnstile();
      if (!res.ok || typeof res.d.score !== 'number') {
        examStatus.textContent = res.d.message || 'Something went wrong. Please try again.';
        return;
      }
      examStatus.textContent = '';
      form.hidden = true;
      if (res.d.passed) {
        attemptId = res.d.attempt_id;
        document.getElementById('pass-score').textContent = res.d.score;
        passPanel.hidden = false; passPanel.focus();
      } else {
        document.getElementById('fail-score').textContent = res.d.score;
        failPanel.hidden = false; failPanel.focus();
      }
      window.scrollTo({top: document.getElementById('exam-section').offsetTop - 80, behavior: 'smooth'});
    }).catch(function(){
      submitBtn.disabled = false;
      resetTurnstile();
      examStatus.textContent = 'Network error. Please try again.';
    });
  });

  document.getElementById('retake-btn').addEventListener('click', function(){
    form.reset();
    progress.textContent = 'Answered 0 of ' + TOTAL;
    failPanel.hidden = true;
    form.hidden = false;
    resetTurnstile();
    window.scrollTo({top: document.getElementById('exam-section').offsetTop - 80, behavior: 'smooth'});
  });

  // Same rules as the server (functions/_lib/exam.js cleanName/cleanEmail).
  function cleanName(raw){
    var name = String(raw || '').normalize('NFC').replace(/\\s+/gu, ' ').trim();
    if (name.length < ${NAME_MIN} || name.length > ${NAME_MAX}) return null;
    if (!/^[\\p{L}\\p{M}][\\p{L}\\p{M} .'\\u2019-]*$/u.test(name)) return null;
    if (!/\\p{L}.*\\p{L}/su.test(name)) return null;
    return name;
  }
  function cleanEmail(raw){
    var email = String(raw || '').trim().toLowerCase();
    if (email.length > 254) return null;
    return /^[^\\s@<>"',;:()]+@[^\\s@<>"',;:()]+\\.[^\\s@<>"',;:()]{2,}$/.test(email) ? email : null;
  }

  var claimForm = document.getElementById('claim-form');
  var claimStatus = document.getElementById('claim-status');
  var confirmBox = document.getElementById('confirm-box');
  var confirmStatus = document.getElementById('confirm-status');
  var confirmBtn = document.getElementById('confirm-btn');
  var pending = null;

  claimForm.addEventListener('submit', function(e){
    e.preventDefault();
    claimStatus.textContent = '';
    var name = cleanName(claimForm.full_name.value);
    var email = cleanEmail(claimForm.email.value);
    if (!name) { claimStatus.textContent = 'Please enter your full name (2 to 80 letters; spaces, hyphens, apostrophes and dots are allowed).'; claimForm.full_name.focus(); return; }
    if (!email) { claimStatus.textContent = 'Please enter a valid email address.'; claimForm.email.focus(); return; }
    pending = {name: name, email: email, updates: claimForm.updates.checked};
    document.getElementById('name-preview').textContent = name;
    claimForm.hidden = true;
    confirmBox.hidden = false;
    confirmBtn.focus();
  });

  document.getElementById('edit-btn').addEventListener('click', function(){
    confirmBox.hidden = true;
    claimForm.hidden = false;
    claimForm.full_name.focus();
  });

  confirmBtn.addEventListener('click', function(){
    if (!pending) return;
    confirmBtn.disabled = true;
    confirmStatus.textContent = 'Issuing your certificate...';
    fetch('/api/exam/claim', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({course: COURSE, attempt_id: attemptId, full_name: pending.name, email: pending.email, updates: pending.updates, access_code: accessCode})
    }).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ return {ok: r.ok, d: d}; }); })
    .then(function(res){
      if (!res.ok || !res.d.url) {
        confirmBtn.disabled = false;
        confirmStatus.textContent = res.d.message || 'Something went wrong. Please try again.';
        return;
      }
      if (res.d.existing) {
        confirmStatus.textContent = 'You already have a certificate for this course with this email. Opening it now...';
        setTimeout(function(){ window.location.href = res.d.url; }, 1800);
      } else {
        window.location.href = res.d.url;
      }
    }).catch(function(){
      confirmBtn.disabled = false;
      confirmStatus.textContent = 'Network error. Please try again.';
    });
  });
})();
</script>`;

  return pageShell({
    title,
    description: isPaid
      ? `Take the ${exam.title} Level 2 exam and earn a MEDJAY certificate. An access code from your purchase is required.`
      : `Take the free ${exam.title} Level 1 exam and earn a MEDJAY certificate.`,
    canonical: `https://medjay.pro/exam/${exam.slug}`,
    robots: 'noindex, follow',
    bodyContent,
    extraCss,
    extraHead: '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>',
    extraScript,
  });
}

function renderNotFound() {
  return pageShell({
    title: 'Exam Not Found | MEDJAY',
    noindex: true,
    bodyContent: `
<main id="main">
<section class="hero">
  <div class="wrap">
    <span class="eyebrow">Exams</span>
    <h1>Exam not found</h1>
    <p class="lede">There is no exam at this address. Exams are linked from the course page or your purchase confirmation.</p>
    <p style="margin-top:28px;"><a href="/courses/" class="btn-primary">Browse free courses</a></p>
  </div>
</section>
</main>`,
  });
}
