# IELTS Practice

Exam-style IELTS Academic practice in the browser: Reading, Listening, Writing and Speaking, each as a full timed test.

**Live site:** https://ltd-ielts-tester.netlify.app

Students type their name once, pick a skill and take a test. Reading and Listening are marked straight away with an estimated band. Writing and Speaking go to the teacher by email for marking.

## What's inside

| Skill | Test format | Bank |
| --- | --- | --- |
| **Reading** | Three passages, about 40 questions, 60 minutes | 208 passages (26 practice sets) |
| **Listening** | Four parts, 40 questions. 45 minutes of audio, then 5 minutes to check with the audio locked | 24 tests |
| **Writing** | One Task 1 and one Task 2 in 60 minutes, with a live word count | 187 Task 1 and 98 Task 2 prompts |
| **Speaking** | Three Part 1 topics (up to 10 minutes), then a cue card: 1 minute to prepare, 2 minutes to talk | 72 Part 1 topics, 154 cue cards |

## Features

- **Instant scoring** for Reading and Listening: raw score, estimated band, and a report you can download.
- **Writing question-type filters.** Students choose which prompt types to practise and Shuffle picks from those.
  - Task 1: line graph, bar chart, pie chart, table, mixed charts, map or plan, process diagram.
  - Task 2: opinion, discussion, advantages and disadvantages, problems and solutions, two-part question.
- **Model answers** for Writing, shown after submitting. The answers are also turned into a Word (.docx) file on the device and sent to the teacher.
- **Speaking recording** in the browser. It is saved as MP3 (LAME encoder) and sent to the teacher.
- **Shuffle** for a fresh set of passages, tasks or topics, plus an "only ones I have not done before" option.
- **Saved progress.** Every answer is saved the moment it is entered, unfinished tests can be resumed, and past attempts are listed per skill. Everything is stored on the device, per student.
- **Reliable sending.** Results wait in an outbox and are retried later if the connection drops.
- **Comfort controls**: light and dark mode, larger or smaller text, and smooth scrolling.

## Run it locally

It's a static site with no build step and no dependencies. Serve the folder with any local web server:

```bash
git clone https://github.com/ltd2005the1st-source/ielts-practice.git
cd ielts-practice
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening the HTML files directly can work too, but a server is closer to how the site runs online (and the microphone needs `localhost` or HTTPS).

## Sending results to the teacher

Results, writing and recordings are emailed through a Google Apps Script web app. Its URL is set in [`config.js`](config.js):

```js
window.IRT_CONFIG = {
  endpoint: 'https://script.google.com/macros/s/.../exec'
};
```

If `endpoint` is empty, everything else still works and the app shows a notice that results are not being sent. The Apps Script code itself is not in this repository.

## Project structure

```
index.html       Home page: student name and skill picker
reading.html     Reading tests (all passages and questions live in this file)
listening.html   Listening tests
writing.html     Writing tests, prompts and model answers
speaking.html    Speaking tests and recorder
config.js        Apps Script endpoint for sending results
scroll.js        Smooth scrolling shared by every page
audio/           Listening audio, test-01.mp3 to test-24.mp3
wimg/            Writing Task 1 charts, maps and diagrams
fonts/           Bricolage Grotesque web fonts
vendor/          lame.min.js, the MP3 encoder used by Speaking (LGPL)
netlify.toml     Netlify settings (publish the repo root, no build)
```

## Deployment

The site is hosted on Netlify (site `ltd-ielts-tester`) and deploys automatically from the `main` branch. Merge a change into `main` and it is live in a minute or two.

## Credits

MP3 recordings are made with [LAME](https://lame.sourceforge.net), used under the LGPL licence (see `vendor/LAME-LICENSE.txt`).
