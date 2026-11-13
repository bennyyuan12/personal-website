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

// Two voices. `tldr` is typed on torn paper and reads like a resume. Everything else is written by
// hand and reads the way I'd say it. The facts in both come from the experience bank.
const ENTRIES: Entry[] = [
  {
    id: 'bgmc',
    kind: 'Work',
    title: 'BGMC',
    sub: 'Boston Global Medical Collaboration + Advancing Autism',
    role: 'Full-Stack & Analytics Engineer',
    when: 'Jun 2026 → now',
    where: 'a team of two',
    storyTitle: 'what I took away',
    story: [
      'I thought this job was building forms. Most of it turned out to be finding the spot where people give up on them.',
      'We had a Register button that 27 of every 100 visitors clicked. Instead of arguing about a popup, we split 600 visitors in half for three days: 81 clicks without it, 279 with it. That settled it.',
      'The other thing: a click is not a registration. I count them separately now.',
    ],
    lesson: 'don’t argue about it. test it.',
    tldr: [
      'Built frontend and backend for two bilingual English/Chinese event websites: registration, inquiry and organizer-admin workflows.',
      'Ran a 3-day randomized A/B test of a registration popup with 600 unique visitors; Register click-through rose from 27% to 93%. Shipped the popup.',
      'Migrated the live registration database with zero data loss across 211 registrations and 7 events, verified by before/after integrity checks.',
      'Built a consent-based analytics dashboard tracking registration drop-off by language, device and traffic source.',
    ],
    stack: ['React', 'Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'Vite', 'Neon'],
    big: '27→93%',
    bigNote: 'Register click-through. 600 visitors, 3 days, split at random.',
    art: 'bars-ab',
    artOn: 'graph',
    artNote: 'same page, same three days. the only difference was a popup.',
    aside: '211 in, 211 out. counted before and after.',
  },
  {
    id: 'refitting-room',
    kind: 'Work',
    title: 'The Refitting Room',
    sub: 'alterations for a wardrobe that suddenly doesn’t fit',
    role: 'Founder & Full-Stack Developer',
    when: 'my own venture',
    where: 'built, not launched yet',
    storyTitle: 'why I started it',
    story: [
      'I talked to about a hundred people on GLP-1 medication. They kept saying the same two things: I bought new clothes too early, and I don’t know what’s worth keeping.',
      'So the first thing I built wasn’t a shop. It was a questionnaire that says keep, alter or replace, and it shows you an answer before it asks for your email.',
      'Then I needed real prices, which meant phoning about 400 tailors. I built an AI agent to make the calls, and reviewed what came back.',
    ],
    lesson: 'give the answer first. ask for the email after.',
    tldr: [
      'Founded a wardrobe-alteration venture for professional women navigating GLP-1-related fit changes, shaped by ~100 user conversations.',
      'Built the full-stack platform: authentication, intake, order tracking and admin workflows.',
      'Implemented a rule-based planner that recommends what to keep, alter or replace by fit, wardrobe needs and timing.',
      'Built a human-supervised AI phone agent that made 400 tailor calls; about 80% returned usable pricing, including complete quotes from 60%.',
    ],
    stack: ['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'Node.js', 'Twilio', 'OpenAI Realtime'],
    big: '400 calls',
    bigNote: 'to tailor shops, made by an AI agent with a person checking',
    art: 'calls',
    artSize: [330, 330],
    artNote: 'one dot = one call. dark: a full quote. grey: part of one. empty: nothing I could use.',
    aside: 'what the calls said: $20 to $200+ an item, 5–14 days. rush costs 20–50% more.',
  },
  {
    id: 'odun',
    kind: 'Work',
    title: 'Odun Technology',
    sub: 'market research on pay-to-fish ponds. yes, really.',
    role: 'Data Research Intern',
    when: 'Jun → Dec 2025',
    where: 'Shenzhen',
    storyTitle: 'what I took away',
    story: [
      'Entertainment fishing ponds: people pay to spend an afternoon fishing in them. My job was to work out how big that business is.',
      'I built the number from the ground up. Surveys covering 300 ponds first, then province by province. It came out near $15M a year.',
      'What stuck: it’s easy to make a number sound bigger than it is. Mine is one segment, one year, an estimate. Leave any of that off and it’s a different claim.',
    ],
    lesson: 'a number needs its unit, its year and its limits.',
    tldr: [
      'Estimated a US$15M annual market opportunity for the entertainment fishing pond segment, using surveys covering 300 ponds.',
      'Compared Chinese provinces with penetration heat maps and geographic analysis to show regional differences.',
      'Assessed business economics for due diligence through gross-margin, operating-margin and inventory-turnover analysis.',
      'Turned the pond research into customer-adoption and pricing findings.',
    ],
    stackTitle: 'Methods',
    stack: ['Market sizing', 'Surveys', 'Heat maps', 'Unit economics'],
    big: '$15M',
    bigNote: 'a year, for one segment. an estimate.',
    art: 'fish',
    artSize: [320, 320],
    artNote: '300 ponds in the survey. this is the only fish I drew.',
    aside: 'province by province, on a heat map.',
  },
  {
    id: 'kalodata',
    kind: 'Work',
    title: 'Kalodata',
    sub: 'one product, two countries, two very different first days',
    role: 'Data Science Intern',
    when: 'Jun → Aug 2024',
    where: 'Shenzhen',
    storyTitle: 'what I took away',
    story: [
      'Same product, two countries. In the US, 72 of every 100 new users came back the next day. In China, 32.',
      'The useful question wasn’t how big the gap was. It was where it lived. It kept showing up around one feature, the advanced filters, so that’s what I took to the product team.',
      'I also learnt to say “goes along with” and not “causes”. I had cohorts, not an experiment.',
    ],
    lesson: 'before blaming the user, read the labels.',
    tldr: [
      'Found day-one retention of 32% in China vs. 72% in the US through SQL cohort analysis of ~500 users.',
      'Identified lower advanced-filter adoption in China, with differences by persona and workflow.',
      'Recommended clearer advanced-filter labels and onboarding to Product.',
      'Maintained a cohort dashboard of D1/D7 retention and feature adoption by geography and persona.',
    ],
    stackTitle: 'Tools',
    stack: ['SQL', 'Cohort analysis', 'Dashboards'],
    big: '40 pts',
    bigNote: 'the day-one retention gap between the US and China',
    art: 'bars-ret',
    artOn: 'graph',
    artNote: 'about 500 users. day one = did you come back tomorrow.',
    aside: 'honest note: a recommendation, not a measured lift.',
  },
  {
    id: 'cardiac-rehab',
    kind: 'Project',
    title: 'Home Cardiac Rehab',
    sub: '2nd place, Pulse Foundry AI Healthcare Hackathon',
    role: 'Team project · patient UI',
    when: 'Spring 2026',
    storyTitle: 'why we built it',
    story: [
      'Cardiac rehab is the weeks of supervised exercise after a heart problem. Our team’s bet for the hackathon was that a lot of it could happen at home.',
      'I took the first thing a patient touches: signing up. Step by step, one small question at a time, so the form is never the hard part of getting better.',
      'Then I helped present it. We came second.',
    ],
    lesson: 'the first screen decides if there’s a second.',
    tldr: [
      'Designed and built the patient onboarding UI and step-by-step registration/intake for a home cardiac-rehab MVP.',
      'Team placed 2nd at the Pulse Foundry AI Healthcare Hackathon; co-presented the demo.',
      'Team MVP spans onboarding, activity tracking, care-team dashboards and voice-enabled workflows.',
    ],
    stack: ['React', 'Next.js', 'TypeScript'],
    big: '2nd',
    bigNote: 'place, as a team',
    art: 'heart',
    artSize: [320, 320],
    artNote: 'sign up → tell us about you → the rest of the app.',
    aside: 'a demo with demo data. no real patients.',
  },
  {
    id: 'carecall',
    kind: 'Project',
    title: 'CareCall',
    sub: 'say it to Siri, and an AI agent makes the phone call',
    role: 'Team project · the Siri end',
    when: 'Fall 2026',
    storyTitle: 'why we built it',
    story: [
      'Booking a doctor’s appointment still mostly means a phone call and a hold queue. The idea: say it to Siri once, and an AI agent makes the call for you.',
      'I built the Siri end. The part I worried about most was the boring one: what if the request goes out twice? Nobody wants two appointments.',
      'So every request keeps its own ID, and asking again gets you the first one back.',
    ],
    lesson: 'asking twice should never book twice.',
    tldr: [
      'Built CareCall’s Siri entry point, routing spoken requests to an AI phone agent for medical-appointment booking.',
      'Made appointment requests safe to retry after connection failures, recovering the original submission instead of creating another.',
      'Verified validation, authorization, concurrent submissions and recovery with 45 automated mock tests.',
    ],
    stack: ['Python', 'SQLite', 'Apple Shortcuts', 'LiveKit'],
    big: '45',
    bigNote: 'mock tests: validation, access, retries, recovery',
    art: 'siri',
    artSize: [420, 270],
    artNote: 'you hear “got it” first. the answer comes later.',
    aside: 'a prototype, tested with mock calls. no real clinic was phoned.',
  },
  {
    id: 'safelease',
    kind: 'Project',
    title: 'SafeLease NYC',
    sub: 'a housing-risk map for people renting with a voucher',
    role: 'Team project · frontend & map',
    when: 'NVIDIA Spark Hackathon',
    storyTitle: 'why we built it',
    story: [
      'If you rent with a housing voucher, a listing tells you the price and not much else. We wanted the building to tell on itself before anyone signs.',
      'My part was the thing you actually look at: a 3D map of 2,556 buildings, each coloured by its risk score, with a card that opens when you pick one.',
      'Honest footnote: it’s a hackathon prototype. The scores were demo data, and we didn’t win anything.',
    ],
    lesson: 'a map is only as honest as the data under it.',
    tldr: [
      'Developed the frontend and 3D map of a prototype for housing-voucher holders to explore risk scores across 2,556 NYC building footprints.',
      'Implemented the housing-search UI with risk-colored buildings and property-detail cards.',
      'Integrated backend property records and team risk scores so map colors and cards match the underlying data.',
    ],
    stack: ['React', 'JavaScript', 'Mapbox GL', 'Vite'],
    big: '2,556',
    bigNote: 'building footprints on the map',
    art: 'blocks',
    artNote: 'red = higher risk. real footprints, demo scores.',
    aside: 'team project. the map and the screens are mine.',
  },
  {
    id: 'kyc',
    kind: 'Project',
    title: 'Percy',
    sub: 'a KYC intake & review MVP',
    role: 'End-to-end MVP',
    when: 'Fall 2025',
    storyTitle: 'why I built it',
    story: [
      'KYC is the paperwork that proves a customer is who they say they are. Most cases are dull and obvious. A few are not.',
      'I wanted to see how far plain rules could go before an LLM was needed at all. So Percy reads the emails and PDFs, matches the clear ones itself, and hands the strange ones to a person with notes already written.',
    ],
    lesson: 'use the model last, not first.',
    tldr: [
      'Prototyped Percy, a KYC-review MVP that turns inbound emails and PDFs into structured HubSpot case notes.',
      'Auto-matched clear cases with deterministic rules and queued ambiguous records for human review.',
      'Limited LLM decisions to edge cases.',
      '<a href="https://www.loom.com/share/9e1e8cb907394b448f065ac9c29106b8">Watch the demo (Loom)</a>',
    ],
    stack: ['HubSpot', 'Email + PDF intake', 'Rules', 'LLM'],
    big: 'rules 1st',
    bigNote: 'the LLM only sees what the rules can’t settle',
    art: 'flow-kyc',
    artOn: 'graph',
    artSize: [440, 300],
    artNote: 'five parts: seeder, processor, matcher, agent, reviewer screen.',
    aside: 'seeded test emails, not real customers.',
  },
  {
    id: 'revenue-funnel',
    kind: 'Project',
    title: 'Revenue Funnel',
    sub: 'from first deal to cancelled card, in SQL',
    role: 'Independent project',
    when: 'Summer 2024',
    storyTitle: 'why I built it',
    story: [
      'A practice project with made-up data, and I’d rather say so here than let it sound bigger.',
      'I wanted to follow one customer the whole way: from a deal in a sales pipeline, to their first payment, to the month they stop paying.',
      'What I kept from it: a failed card and a decision to leave both look like churn on a chart. They are not the same problem.',
    ],
    lesson: 'a failed payment is not a goodbye.',
    tldr: [
      'Built a revenue-funnel analytics project on synthetic pipeline, activation and subscription data modeled on HubSpot and Stripe.',
      'Modeled MRR, activation, churn and cohort retention in SQL on one shared data model.',
      'Separated failed-payment churn from voluntary cancellations by plan and customer segment.',
    ],
    stackTitle: 'Tools',
    stack: ['SQL', 'Data modeling', 'KPI dashboards'],
    big: 'MRR',
    bigNote: 'plus churn, activation and retention, from one set of tables',
    art: 'funnel',
    artOn: 'kraft',
    artSize: [320, 320],
    artNote: 'the data is synthetic. the plumbing is real.',
    aside: 'no real company’s numbers are in here.',
  },
  {
    id: 'cssa',
    kind: 'Community',
    title: 'CSSA',
    sub: 'Chinese Students & Scholars Association',
    role: 'Head of Career & Community Development',
    when: 'Sep 2023 → now',
    storyTitle: 'what I took away',
    story: [
      'Nothing on this page is code. It’s fifteen people, a venue that has to be booked, and a speaker who hasn’t replied yet.',
      'What I learnt is that a team doesn’t run on enthusiasm. Each sub-team got a target, and I kept track of them in a plain Excel sheet.',
      'And most things start with asking. The Amazon tour did.',
    ],
    lesson: 'ask. the worst answer is no.',
    tldr: [
      'Led a 15-member team delivering career and networking events for 200+ attendees.',
      'Negotiated partnerships that supported $8K in combined ticket sales and sponsorship.',
      'Organized an Amazon company tour for 80+ students with employee hosts.',
    ],
    stackTitle: 'Scope',
    stack: ['Venues', 'Speakers', 'Logistics', 'Promotion'],
    big: '200+',
    bigNote: 'attendees at our career and networking events',
    art: 'megaphone',
    artSize: [320, 320],
    artNote: '80+ students came on the Amazon tour.',
    aside: '$8K = tickets + sponsors together.',
  },
];

/** What each one is called in the list: its full name, and a line short enough to stay on one. */
const NAMES: Record<string, string> = {
  bgmc: 'BGMC + Advancing Autism',
  'cardiac-rehab': 'Home Cardiac Rehab MVP',
  kyc: 'Percy: KYC Intake & Review',
  'revenue-funnel': 'Revenue Funnel & Churn',
};
const LINES: Record<string, string> = {
  bgmc: 'Full-Stack & Analytics Engineer · 2026 – now',
  'refitting-room': 'Founder & Full-Stack Developer',
  odun: 'Data Research Intern · 2025',
  kalodata: 'Data Science Intern · 2024',
  'cardiac-rehab': '2nd place, Pulse Foundry hackathon',
  carecall: 'Siri → an AI phone agent · 2026',
  safelease: 'NVIDIA Spark Hackathon prototype',
  kyc: 'End-to-end MVP · 2025',
  'revenue-funnel': 'SQL on synthetic data · 2024',
  cssa: 'Student leadership · since 2023',
};
/** The doodle beside each row: the figures are too detailed to read that small. */
const ICONS: Record<string, string> = { bgmc: 'badge', 'refitting-room': 'hanger', kalodata: 'chart', carecall: 'phone', safelease: 'building', kyc: 'doc' };
const row = (e: Entry) => ({ title: NAMES[e.id] ?? e.title, line: LINES[e.id], art: ICONS[e.id] ?? e.art, goto: e.id });
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
const projects = ENTRIES.filter((e) => e.kind === 'Project');
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
