import badge from './art/badge.svg?raw';
import building from './art/building.svg?raw';
import cap from './art/cap.svg?raw';
import chart from './art/chart.svg?raw';
import fish from './art/fish.svg?raw';
import gelato from './art/gelato.svg?raw';
import hanger from './art/hanger.svg?raw';
import heart from './art/heart.svg?raw';
import megaphone from './art/megaphone.svg?raw';

export interface Experience {
  id: string;
  art: string;
  title: string;
  role: string;
  when: string;
  note: string;
}

/** What's hidden in the grass. Everything here comes from the resume. */
export const EXPERIENCE: Experience[] = [
  {
    id: 'bgmc',
    art: badge,
    title: 'Boston Global Medical Collaboration',
    role: 'Full-Stack & Analytics Engineer',
    when: 'June 2026 to now',
    note: 'Bilingual registration, admin and inquiry workflows in Next.js, TypeScript and PostgreSQL, plus first-party analytics.',
  },
  {
    id: 'refitting',
    art: hanger,
    title: 'The Refitting Room',
    role: 'Founder & Full-Stack Developer',
    when: 'Independent venture',
    note: 'Customer and admin workflows for garment intakes, orders, shipments and private photo uploads.',
  },
  {
    id: 'odun',
    art: fish,
    title: 'Odun Technology',
    role: 'Data Research Intern',
    when: 'June to December 2025',
    note: 'Unit economics, a bottom-up market model and regional heat maps, for fishing ponds.',
  },
  {
    id: 'kalodata',
    art: chart,
    title: 'Kalodata',
    role: 'Data Science Intern',
    when: 'Summer 2024',
    note: 'Compared US and China retention cohorts, found a D1 retention gap, and kept a D1/D7 retention dashboard.',
  },
  {
    id: 'safelease',
    art: building,
    title: 'SafeLease NYC',
    role: 'NVIDIA Spark Hackathon prototype',
    when: 'Team project',
    note: 'Co-developed a housing-risk explorer with React, Python, FastAPI and Mapbox GL.',
  },
  {
    id: 'rehab',
    art: heart,
    title: 'Home Cardiac Rehab MVP',
    role: '2nd place, Pulse Foundry AI Healthcare Hackathon',
    when: 'Spring 2026',
    note: 'Contributed to a Next.js and TypeScript MVP with activity tracking and care-team dashboards.',
  },
  {
    id: 'cssa',
    art: megaphone,
    title: 'CSSA',
    role: 'Head of Career and Community Development',
    when: 'Since September 2023',
    note: 'Led a 15-member team on networking events for 200+ attendees, and hosted an Amazon company tour for 80+ students.',
  },
  {
    id: 'nyu',
    art: cap,
    title: 'New York University',
    role: 'B.A. Data Science, minor in Business Studies',
    when: 'May 2026',
    note: 'GPA 3.7. Data management, causal inference and machine learning.',
  },
  {
    id: 'florence',
    art: gelato,
    title: 'NYU Florence',
    role: 'Exchange semester',
    when: 'Fall 2023',
    note: 'Italian, art history and philosophy.',
  },
];
