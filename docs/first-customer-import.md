# First Customer: content import and go-live

The page, template, download page and exam wiring for the founder course
"First Customer" are built. The course content is not imported yet, so
`/founders/first-customer/` is `noindex`, is not in the sitemap, and its
Download / Exam buttons and content sections are inside
`<template data-pending="scc-import">` blocks (browsers do not render them).

Do the steps in order. Steps 1 to 4 can be done in one change; step 5
switches the page live.

## 1. Course page content

File: `founders/first-customer/index.html`

- Replace every `[[TOKEN]]` with text from the SCC export
  (`[[OUTCOME_n]]`, `[[DAY_n_TITLE]]`, `[[DAY_n_SUMMARY]]`, `[[DAY_n_LEARN]]`,
  `[[DAY_n_THINK]]`, `[[DAY_n_STRETCH]]`, `[[DAY_n_INSIDE]]`,
  `[[HOW_EACH_DAY_WORKS]]`, `[[READING_n]]`). Add or remove list items as
  the content needs.
- Replace the provisional "Who it's for" paragraph (marked IMPORT FROM SCC).
- In the JSON-LD `Course` block, add `syllabusSections` with ten entries
  (`"Day N: title"` + description), same shape as
  `courses/b2b-sales-essentials/index.html`.
- Check the meta description and the `10 days · Self-study · Free` line.
  Note: the certificate, verify page and certificate email print
  "First Customer — Level 1" (shared engine wording).

## 2. PDFs and download page

- Add to `courses/files/`: `first-customer-day-1.pdf` ... `first-customer-day-10.pdf`
  and `first-customer-all.zip` (these names are what `/api/dl` redirects to).
- File: `founders/first-customer/download/index.html`: add each day's title
  to its button label (marked IMPORT FROM SCC).
- Downloads of day 1 to 5 and the zip are counted like the other courses;
  days 6 to 10 are served but not counted.

## 3. Exam questions (repo)

File: `functions/_data/exam-questions.json`: add one entry to `exams`:

```json
{
  "slug": "first-customer",
  "prefix": "FCU",
  "title": "First Customer",
  "course_url": "/founders/first-customer/",
  "total": 20,
  "pass_mark": 14,
  "questions": [
    { "id": "FCU-Q01", "no": 1, "stem": "...", "options": { "A": "...", "B": "...", "C": "...", "D": "..." } }
  ]
}
```

- `course_url` makes the exam page's "Back to the course" link point at
  `/founders/first-customer/` instead of `/courses/first-customer/`.
- Never put correct answers in this file.
- Update `tests/exam.test.js` ("11 exams" becomes 12; add the FCU prefix).

## 4. Exam row and answer keys (D1, not in the repo)

Run in the D1 Console (medjay-articles), with the real answer letters:

```sql
INSERT OR REPLACE INTO exams (course_slug, prefix, title, total, pass_mark, active)
VALUES ('first-customer', 'FCU', 'First Customer', 20, 14, 1);

INSERT OR REPLACE INTO exam_keys (course_slug, question_no, correct) VALUES
  ('first-customer', 1, '?'),
  -- ... one row per question, 1 to 20, each 'A', 'B', 'C' or 'D'
  ('first-customer', 20, '?');
```

Until both exist, `/exam/first-customer` answers "not ready" (503) on submit.

## 5. Switch the page live

File: `founders/first-customer/index.html`

1. Delete the four `<template data-pending="scc-import">` / `</template>`
   lines (two around the hero buttons, two around the content sections).
2. Change `<meta name="robots" content="noindex, follow">` to
   `content="index, follow"` and delete the comment block at the top.
3. In `functions/sitemap.xml.js`, add to `STATIC_PAGES`:
   `{ path: '/founders/first-customer/', changefreq: 'monthly', priority: '0.7' },`
4. Optional: on `founders/index.html`, change the card button from
   "View the course" to "Start free".
5. Run the tests (`cd tests && npm test`). `tests/founders.test.js` fails if
   the page is set to index while any `[[TOKEN]]` or pending `<template>`
   is left, or if the sitemap and the robots tag disagree.
