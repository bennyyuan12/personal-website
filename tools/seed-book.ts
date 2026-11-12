// Lays out the first copy of the book from the resume: `npm run seed`.
// The book is edited in the browser after that (`npm run edit`), so this refuses to overwrite one
// that already exists unless it's run with --force.

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { entrySpread, kit, listRow, postSpread, tilt, type Entry } from '../src/book/templates';
import type { BookData, Item, Page } from '../src/book/types';

const OUT = path.resolve('public/book/book.json');

let made = 0;
const id = () => `i${(++made).toString(36)}`;
const k = kit(id);

const ENTRIES: Entry[] = [
  {
    id: 'bgmc',
    kind: 'Work',
    title: 'Boston Global Medical Collaboration',
    role: 'Full-Stack & Analytics Engineer',
    when: 'Jun 2026 – now',
    summary: 'Bilingual registration, admin and inquiry workflows, plus the first-party analytics that show how people move through them.',
    did: [
      'Built bilingual registration, admin and inquiry workflows in Next.js, TypeScript and PostgreSQL, with API validation, duplicate-safe saving and CSV exports.',
      'Supported an additive PostgreSQL release that preserved 211 registrations and seven events.',
      'Added event deduplication, bounded retries, reconciliation and retention to the analytics.',
      'Tied consented browsing to saved registration outcomes. Withdrawing consent removes the measurement data and keeps the business records.',
    ],
    stack: ['Next.js', 'TypeScript', 'PostgreSQL'],
    big: '211',
    bigNote: 'registrations carried through a database release',
    note: 'bilingual, start to finish',
    sticky: 'duplicate-safe = pressing submit twice is fine',
    art: 'badge',
  },
  {
    id: 'refitting-room',
    kind: 'Work',
    title: 'The Refitting Room',
    role: 'Founder & Full-Stack Developer',
    when: 'My own venture',
    summary: 'My own venture: customer and admin workflows for garment intakes, order status, shipments and audit records.',
    did: [
      'Built the customer and admin sides in Next.js, TypeScript and PostgreSQL, behind authenticated access.',
      'Set up Auth.js sign-in, account recovery and role-based access, with ownership checks on private garment photos.',
      'Made submissions retry-safe: an exact retry returns the saved record, and a failed notification still keeps the lead.',
      'Used Zod validation, Prisma transactions and idempotent webhooks to keep orders consistent across retries.',
    ],
    stack: ['Next.js', 'TypeScript', 'PostgreSQL', 'Prisma', 'Auth.js', 'Zod'],
    big: 'retry-safe',
    bigNote: 'an exact retry returns the record already saved',
    note: 'hence the hanger',
    sticky: 'verification tokens are stored hashed',
    art: 'hanger',
  },
  {
    id: 'odun',
    kind: 'Work',
    title: 'Odun Technology',
    role: 'Data Research Intern',
    when: 'Jun – Dec 2025',
    summary: 'Research on the business of fishing ponds: unit economics, the size of the market and where to expand.',
    did: [
      'Analyzed gross margin, operating margin and inventory turnover to assess unit economics for due diligence.',
      'Built a bottom-up market model from operational drivers, for go-to-market planning and investment discussions.',
      'Made regional penetration analyses and heat maps to compare expansion markets.',
      'Combined public sources, surveys and interviews to find what drives adoption and pricing.',
    ],
    stack: ['Unit economics', 'Market model', 'Heat maps'],
    big: 'bottom-up',
    bigNote: 'a market model built from operational drivers',
    note: 'yes, the fish is for the fishing ponds',
    sticky: 'public sources + surveys + interviews',
    art: 'fish',
  },
  {
    id: 'kalodata',
    kind: 'Work',
    title: 'Kalodata',
    role: 'Data Science Intern',
    when: 'Jun – Aug 2024',
    summary: 'Retention analysis across two markets: why adoption looked different in the US and China, and what to improve in onboarding.',
    did: [
      'Analyzed US and China retention cohorts and found a D1 retention gap.',
      'Segmented cohorts by persona and workflow to study advanced-filter adoption and churn in China.',
      'Worked with Product to clarify advanced-filter labels after the analysis surfaced the difference.',
      'Kept a cohort dashboard of D1/D7 retention and feature adoption by geography and persona.',
    ],
    stack: ['Cohort analysis', 'Retention', 'Dashboards'],
    big: 'D1 / D7',
    bigNote: 'retention, tracked by geography and persona',
    note: 'US and China, side by side',
    sticky: 'clearer filter labels came out of this',
    art: 'chart',
  },
  {
    id: 'safelease',
    kind: 'Project',
    title: 'SafeLease NYC',
    role: 'NVIDIA Spark Hackathon prototype',
    when: 'Team project',
    summary: 'A housing-risk explorer built with a team: search an address, see it on the map, read the building’s profile.',
    did: [
      'Co-developed it with React, Python, FastAPI and Mapbox GL.',
      'Normalized property identifiers and joined housing records to building footprints with Python-generated GeoJSON.',
      'Kept unmatched scores as null and reported the join coverage.',
      'The prototype has cached lookups, fallback sources and mock tests for malformed property IDs.',
    ],
    stack: ['React', 'Python', 'FastAPI', 'Mapbox GL'],
    big: 'null',
    bigNote: 'what an unmatched score stays, with coverage reported',
    note: 'address → map → building profile',
    sticky: 'built with a team at the NVIDIA Spark Hackathon',
    art: 'building',
  },
  {
    id: 'cardiac-rehab',
    kind: 'Award',
    title: 'Home Cardiac Rehab MVP',
    role: '2nd place · Pulse Foundry AI Healthcare Hackathon',
    when: 'Spring 2026',
    summary: 'A home cardiac-rehab MVP built at a hackathon: onboarding, activity tracking, care-team dashboards and voice-enabled safety workflows.',
    did: [
      'Contributed to the Next.js and TypeScript app.',
      'Modeled demo data for OCR intake, rehabilitation sessions, wearable metrics and care-team alerts.',
      'Set those workflows up so the whole thing could be tested end to end.',
    ],
    stack: ['Next.js', 'TypeScript'],
    big: '2nd',
    bigNote: 'place, Pulse Foundry AI Healthcare Hackathon',
    note: 'spring 2026',
    sticky: 'care-team dashboards + voice safety checks',
    art: 'heart',
  },
  {
    id: 'tailor-agent',
    kind: 'Project',
    title: 'AI Tailor Research Agent',
    role: 'Supervised prototype',
    when: 'Prototype',
    summary: 'A supervised voice-research prototype. It gathers prices, turnaround ranges and rush availability, and keeps the original wording for an operator to review.',
    did: [
      'Connected Twilio Media Streams, OpenAI Realtime and optional ElevenLabs speech over WebSockets, in Node.js.',
      'Extracted prices, turnaround ranges and rush availability into structured records with distinct outcome states.',
      'Added provider-readiness checks, a bounded audio preflight and stream cleanup for debugging real-time voice.',
    ],
    stack: ['Node.js', 'WebSockets', 'Twilio', 'OpenAI Realtime'],
    big: 'supervised',
    bigNote: 'outcomes are kept for an operator to review',
    note: 'a prototype: not yet proven in real use',
    sticky: 'keeps the original wording, not just a summary',
    art: 'phone',
  },
  {
    id: 'kyc',
    kind: 'Project',
    title: 'KYC Intake & Adjudication MVP',
    role: 'End-to-end MVP',
    when: 'Fall 2025',
    summary: 'An MVP that takes in emails and PDFs, pulls out identity fields and writes structured case notes into HubSpot.',
    did: [
      'Built the flow end to end: document intake, field extraction and structured HubSpot case notes.',
      'Designed deterministic matching for the clear cases and a review queue for the ambiguous ones.',
      'Limited LLM use to edge-case decisions.',
    ],
    stack: ['HubSpot', 'Email + PDF', 'Review queue'],
    big: 'review queue',
    bigNote: 'where ambiguous records go, for a person to decide',
    note: 'clear cases: rules. edge cases: LLM.',
    sticky: 'scope: intake, case notes, human-review routing',
    art: 'doc',
  },
  {
    id: 'revenue-funnel',
    kind: 'Project',
    title: 'Revenue Funnel & Churn Analytics',
    role: 'Stripe + HubSpot',
    when: 'Summer 2024',
    summary: 'HubSpot pipeline data joined to Stripe activation and subscription records, to see where customers drop off and how long deals take to close.',
    did: [
      'Unified pipeline, activation and subscription data to analyze conversion drop-offs and time-to-close.',
      'Compared retention and churn cohorts by plan and segment, separating payment-failure churn from voluntary churn.',
      'Built SQL models and analysis-ready tables for consistent MRR, churn, activation and cohort-retention reporting.',
    ],
    stack: ['SQL', 'Stripe', 'HubSpot'],
    big: 'MRR',
    bigNote: 'plus churn, activation and cohort retention, from one set of tables',
    note: 'a failed payment ≠ choosing to leave',
    sticky: 'two kinds of churn, kept apart',
    art: 'funnel',
  },
  {
    id: 'cssa',
    kind: 'Community',
    title: 'CSSA',
    role: 'Head of Career & Community Development',
    when: 'Since Sep 2023',
    summary: 'Student leadership: I led the team that runs career and networking events for the community.',
    did: [
      'Led a 15-member team delivering networking events for 200+ attendees: venues, logistics, speakers and promotion.',
      'Negotiated partnerships that secured $8K in ticket sales and sponsorship.',
      'Organized an Amazon company tour with employees, hosting 80+ students.',
      'Set outreach targets and tracked sub-team performance in Excel.',
    ],
    stack: ['Events', 'Partnerships', 'Excel'],
    big: '200+',
    bigNote: 'attendees at our networking events',
    note: '80+ students on the Amazon tour',
    sticky: '$8K in ticket sales and sponsorship',
    art: 'megaphone',
  },
];

/** What each one is called in the list: short enough to stay on one line. */
const LINES: Record<string, string> = {
  bgmc: 'Full-Stack & Analytics Engineer · 2026 – now',
  'refitting-room': 'Founder & Full-Stack Developer',
  odun: 'Data Research Intern · 2025',
  kalodata: 'Data Science Intern · 2024',
  safelease: 'NVIDIA Spark Hackathon prototype',
  'cardiac-rehab': '2nd place, Pulse Foundry hackathon',
  'tailor-agent': 'Supervised voice prototype',
  kyc: 'End-to-end MVP · 2025',
  'revenue-funnel': 'Stripe + HubSpot · 2024',
  cssa: 'Student leadership',
};
const row = (e: Entry) => ({ title: e.title, line: LINES[e.id], art: e.art, goto: e.id });
const DRAFT = (x: number, y: number, rot: number) => k.text('stamp', 'Draft', x, y, 260, { ink: 'red', rot, align: 'center' });

// ---- the front of the book ----

const hello: Page = {
  id: 'hello',
  name: 'This book belongs to',
  items: [
    k.sticker('tape-green', 380, 214, 240, 54, { rot: -4 }),
    k.text('label', 'This book belongs to', 150, 300, 700, { align: 'center' }),
    k.text('title', 'Benny Yuan', 80, 372, 840, { size: 1.42, align: 'center', rot: -3 }),
    k.sticker('underline', 230, 548, 540, 40, { ink: 'red', rot: -3 }),
    k.text('caption', '(BinHuai)', 610, 590, 260, { rot: 5 }),
    k.text('body', 'full-stack engineering<br>&amp; data', 150, 700, 700, { align: 'center' }),
    k.sticker('nap', 320, 850, 360, 252),
    k.text('stamp', 'If found, return to the grass', 150, 1164, 700, { ink: 'red', size: 0.74, align: 'center', rot: -4 }),
  ],
};

const sections = [
  { goto: 'experience', title: 'Experience', line: 'What I’ve built, analyzed and organized.', tape: 'tape-red' },
  { goto: 'tech', title: 'My Take on Tech', line: 'Notes on building software.', tape: 'tape-kraft' },
  { goto: 'about', title: 'About Me', line: 'School, tools, languages, where to find me.', tape: 'tape-green' },
  { goto: 'jazz', title: 'Ya Like Jazz?', line: 'What doesn’t fit on a resume.', tape: 'tape-blue' },
];

const contents: Page = {
  id: 'contents',
  name: 'Contents',
  items: [
    k.text('title', 'Contents', 76, 84, 700, { size: 0.9, rot: -2 }),
    ...sections.flatMap(({ goto, title, line, tape }, i): Item[] => {
      const y = 300 + i * 232;
      return [
        k.sticker(tape, 52, y + 6, 250, 56, { rot: tilt(i + 20, 5) }),
        k.text('heading', title, 96, y, 620, { size: 1.14, goto, rot: tilt(i + 9, 1.4) }),
        k.text('body', line, 100, y + 84, 640, { size: 0.82, goto }),
        k.text('label', 'p. {{page}}', 740, y + 22, 190, { align: 'right', goto }),
      ];
    }),
    k.text('caption', 'or grab a tag on the side', 430, 1236, 400, { align: 'right', rot: -2 }),
    k.sticker('arrow', 840, 1226, 110, 60, { rot: -18 }),
  ],
};

// ---- experience ----

const work = ENTRIES.filter((e) => e.kind === 'Work');
const projects = ENTRIES.filter((e) => e.kind === 'Project' || e.kind === 'Award');
const community = ENTRIES.filter((e) => e.kind === 'Community');

const experience: Page = {
  id: 'experience',
  name: 'Experience: the list',
  items: [
    k.text('title', 'Experience', 68, 78, 820, { size: 1.1, rot: -2 }),
    k.sticker('underline', 76, 208, 560, 38, { ink: 'red', rot: -2 }),
    k.text('body', 'Things I’ve built, analyzed and organized. Pick one and the book flips to it.', 76, 270, 840, { size: 0.9 }),
    k.text('label', 'Work', 76, 400, 300, { backing: 'dymo' }),
    ...work.flatMap((e, i) => listRow(id, row(e), 478 + i * 200, i)),
  ],
};

const experience2: Page = {
  id: 'experience-2',
  name: 'Experience: the list, continued',
  items: [
    k.text('label', 'Projects', 76, 72, 300, { backing: 'dymo', ink: 'red' }),
    ...projects.flatMap((e, i) => listRow(id, row(e), 148 + i * 180, i + 10)),
    k.text('label', 'Community', 76, 1062, 300, { backing: 'dymo', ink: 'green' }),
    ...community.flatMap((e, i) => listRow(id, row(e), 1136 + i * 180, i + 20)),
  ],
};

const details = [...work, ...projects, ...community].flatMap((e, i) => entrySpread(id, e, i + 1, 'experience'));

// ---- my take on tech ----
// These words are placeholders written for Benny, and say so on the page.

const [post, post2] = postSpread(id, 'four-things', 'Four things I keep coming back to', 'tech');
post.items = post.items.filter((item) => item.type !== 'text' || (item.style !== 'body' && item.style !== 'stamp'));
post.items.push(
  DRAFT(650, 388, 6),
  k.text(
    'body',
    '<p><b>1. The second submit is the real test.</b> Anything works once. The interesting part is what happens on the retry, the double click and the webhook that arrives twice.</p><p><b>2. Numbers should admit what they don’t know.</b> A dashboard is more useful when it says where its data stops, and keeps test assumptions apart from what real people did.</p>',
    80, 500, 840,
  ),
);
post2.items = [
  k.text(
    'body',
    '<p><b>3. AI still needs a reviewer.</b> I like building with it. I also like keeping the original words, the unclear cases and a person who can check the result.</p><p><b>4. Boring choices leave room for fun ones.</b> Solid data and plain workflows are what make it possible to spend a week on a field of ASCII grass.</p>',
    80, 100, 840,
  ),
  k.sticker('laptop', 560, 760, 300, 300, { rot: 6 }),
  k.text('note', 'Benny: these four are placeholder words. Rewrite them or delete this post.', 84, 800, 400, { backing: 'sticky', rot: -3, size: 0.84, ink: 'red' }),
];

const tech: Page = {
  id: 'tech',
  name: 'My Take on Tech: the list',
  items: [
    k.text('title', 'My Take on Tech', 68, 78, 860, { size: 0.86, rot: -2 }),
    k.sticker('underline', 76, 196, 620, 38, { ink: 'red', rot: -2 }),
    k.text('body', 'Notes on building software. New ones get taped in as I write them.', 76, 262, 840, { size: 0.9 }),
    k.text('label', 'Posts', 76, 400, 300, { backing: 'dymo' }),
    ...listRow(id, { title: 'Four things I keep coming back to', line: 'Draft', art: 'laptop', goto: 'four-things' }, 478, 31),
    DRAFT(660, 660, -6),
  ],
};

const tech2: Page = {
  id: 'tech-2',
  name: 'My Take on Tech: more to come',
  paper: 'grid',
  items: [
    k.text('heading', 'more soon', 240, 420, 560, { align: 'center', rot: -3 }),
    k.sticker('sparkle', 420, 560, 180, 180),
    k.text('note', 'Benny: to add a post, run “npm run edit” and pick “Blog post”.', 250, 820, 500, { backing: 'sticky', rot: 2, size: 0.84, ink: 'red' }),
  ],
};

// ---- about me ----

const about: Page = {
  id: 'about',
  name: 'About Me',
  items: [
    k.text('title', 'About Me', 68, 78, 800, { size: 1.1, rot: -2 }),
    k.sticker('underline', 76, 208, 480, 38, { ink: 'red', rot: -2 }),
    k.text('body', 'I’m Benny (BinHuai) Yuan. I work across full-stack engineering and data.', 80, 290, 760, { backing: 'card', rot: -1 }),
    k.sticker('cap', 76, 600, 170, 170, { rot: -6 }),
    k.text('body', '<b>New York University</b><br>B.A. in Data Science, minor in Business Studies.<br><small>May 2026 · GPA 3.7</small>', 270, 596, 660, { size: 0.9 }),
    k.text('caption', 'data management, causal inference, machine learning', 280, 800, 620, { rot: -1.5 }),
    k.sticker('gelato', 740, 930, 170, 170, { rot: 8 }),
    k.text('body', '<b>NYU Florence</b><br>Exchange semester, fall 2023.<br><small>Italian, art history and philosophy.</small>', 84, 940, 620, { size: 0.9 }),
    k.sticker('tape-cream', 320, 262, 220, 50, { rot: 2 }),
  ],
};

const about2: Page = {
  id: 'about-2',
  name: 'About Me: tools and where to find me',
  items: [
    k.text('heading', 'Tools I reach for', 78, 80, 800, { rot: -1.2 }),
    ...[
      ['TypeScript', 84, 200, 'ink'], ['Next.js', 420, 196, 'red'], ['Node.js', 660, 206, 'ink'],
      ['PostgreSQL', 110, 286, 'green'], ['Prisma', 440, 290, 'ink'], ['Python', 650, 284, 'blue'],
      ['SQL', 90, 374, 'red'], ['FastAPI', 250, 378, 'ink'], ['Excel', 500, 370, 'green'], ['Git', 720, 376, 'ink'],
    ].map(([word, x, y, ink], i) =>
      k.text('label', word as string, x as number, y as number, (word as string).length * 20.5 + 84, {
        backing: 'dymo', ink: ink as 'ink', rot: tilt(i + 40, 3),
      }),
    ),
    k.text('heading', 'Languages', 78, 520, 800, { rot: -1 }),
    k.text('body', 'English and Mandarin, both native.<br>Italian, basic.', 84, 610, 800),
    k.text('heading', 'Find me', 78, 800, 800, { rot: -1.4 }),
    k.text('body', '<a href="https://github.com/bennyyuan12">github.com/bennyyuan12</a>', 84, 892, 800),
    k.text('note', 'or in the grass, asleep', 420, 1040, 440, { backing: 'sticky', rot: 4 }),
    k.sticker('nap', 110, 1080, 250, 175, { rot: -4 }),
  ],
};

// ---- ya like jazz? ----

const jazz: Page = {
  id: 'jazz',
  name: 'Ya Like Jazz?',
  items: [
    k.text('title', 'Ya Like Jazz?', 68, 78, 860, { size: 0.96, rot: -2 }),
    k.sticker('underline', 76, 204, 600, 38, { ink: 'red', rot: -2 }),
    k.text('body', 'The things I like that don’t fit on a resume.', 76, 270, 840, { size: 0.9 }),
    k.sticker('bee', 330, 440, 340, 340, { rot: -8 }),
    DRAFT(640, 800, 7),
    k.text('note', 'Benny: what goes here? Records, shows, a favorite solo?', 110, 930, 480, { backing: 'sticky', rot: -3, size: 0.84, ink: 'red' }),
  ],
};

const jazz2: Page = {
  id: 'jazz-2',
  name: 'Ya Like Jazz?: the lists',
  paper: 'lined',
  items: [
    k.text('heading', 'On repeat', 150, 96, 700, { rot: -1 }),
    k.text('note', '1.<br>2.<br>3.', 160, 196, 600, { size: 1.06, ink: 'blue' }),
    k.text('heading', 'Best show I’ve seen', 150, 470, 760, { rot: -1 }),
    k.text('heading', 'Would rather be doing', 150, 760, 800, { rot: -1 }),
    k.text('note', 'napping in long grass', 170, 852, 600, { ink: 'blue', rot: -1 }),
    k.sticker('sax', 600, 960, 300, 300, { rot: 8 }),
  ],
};

const book: BookData = {
  version: 1,
  sections: [
    { id: 'front', title: 'Front', tab: null, color: '#2c3b23', pages: [hello, contents] },
    { id: 'experience', title: 'Experience', tab: 'Experience', color: '#b9502f', pages: [experience, experience2, ...details] },
    { id: 'tech', title: 'My Take on Tech', tab: 'Tech takes', color: '#b8861f', pages: [tech, tech2, post, post2] },
    { id: 'about', title: 'About Me', tab: 'About me', color: '#2f6f6a', pages: [about, about2] },
    { id: 'jazz', title: 'Ya Like Jazz?', tab: 'Jazz?', color: '#6d4a7a', pages: [jazz, jazz2] },
  ],
};

if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(`${path.relative('.', OUT)} already exists. It may hold edits made in the browser.\nRun with --force to replace it with the first copy.`);
  process.exit(1);
}
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(book, null, 2)}\n`);
const pages = book.sections.reduce((n, s) => n + s.pages.length, 0);
console.log(`wrote ${path.relative('.', OUT)}: ${book.sections.length} sections, ${pages} pages`);
