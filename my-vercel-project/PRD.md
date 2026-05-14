# Stealth Scan — Product Requirements Document
**Version:** 1.0
**Date:** April 7, 2026
**Status:** Current / Shipped

---

## 1. Overview

### 1.1 Product Summary
Stealth Scan is an AI-powered job search automation platform. It continuously monitors job feeds (LinkedIn, RSS), scores each role against the user's professional profile, and auto-generates a tailored application packet — cover letter, role-fit analysis, and common-question answers — ready for human review before submission.

### 1.2 Problem Statement
Active job seekers spend hours per week doing repetitive, low-leverage work: scanning the same LinkedIn filters, writing first-draft cover letters, answering identical screening questions. The quality of their applications is inconsistent and they frequently miss relevant roles. Stealth Scan removes that overhead while keeping the human in the loop at the only moment that matters: the decision to apply.

### 1.3 Target Users
- **Primary:** Mid-career professionals (3–15 years experience) actively searching for a new role.
- **Secondary:** Career changers who need to articulate transferable skills across industries.

### 1.4 Design Principles
1. **Invisible until needed.** The system works overnight; the user shows up to a prepared queue.
2. **Human review, never blind submission.** Auto-apply is optional and off by default; all packets go through a review step.
3. **Quality over quantity.** Fit scoring with a hard floor (≥ 50%) keeps the queue signal-dense.

---

## 2. User Flows

### 2.1 Onboarding
1. Sign up via Clerk (email or OAuth).
2. Create a **Search Profile** (target roles, seniority, locations, daily limit, LinkedIn search URLs, optional RSS feeds).
3. Upload at least one **Resume** (PDF via UploadThing; parsed for role tags, domains, seniority).
4. Complete **Professional Profile** (current title, years of experience, skills, industries, work authorization, LinkedIn URL, LinkedIn About text, GitHub/portfolio links).
5. Optionally add **Skill Bullets** — short proof statements used by the AI to construct cover letters.

### 2.2 Nightly Automation Loop
| Time (ET) | Cron Job | Action |
|-----------|----------|--------|
| 6:00 AM   | `/api/cron/scan` | Runs Apify LinkedIn scraper + fetches RSS feeds; deduplicates and stores new jobs |
| 7:00 AM   | `/api/cron/prepare` | Scores all new jobs; generates AI application packets for passing jobs; sends digest email |
| 8:00 AM   | `/api/cron/auto-apply` | Marks approved applications as APPLIED for users with auto-apply enabled |

### 2.3 Review Flow
1. User opens **Queue** tab (applications with status PREPARED).
2. Each card shows: job title, company, location, fit score, fit explanation.
3. Clicking a job opens the **Review Panel**, which shows:
   - **Job Intelligence** (auto-runs on open): role synthesis, hidden scorecard with dealbreaker warnings, ranked skill bullet rewrites, cover letter angle, keywords.
   - **Cover Letter** (editable).
   - **Common Questions** (pre-answered).
   - **Actions:** Approve → APPLIED, Reject, Regenerate.

---

## 3. Feature Specifications

### 3.1 Job Scanning

**3.1.1 LinkedIn Scraping**
- Users paste one or more LinkedIn job search page URLs into their Search Profile.
- Apify actor runs each URL at 6 AM, returning up to N results per URL.
- Results are deduplicated by URL hash before insertion.

**3.1.2 RSS Feeds**
- Users paste optional RSS feed URLs (Google Alerts, niche boards).
- System fetches and parses feeds; stores unique entries as Job records.

**3.1.3 Job Record Schema**
```
title, company, location, description, requirements, url, source, fetchedAt, status (ACTIVE / EXPIRED)
```

---

### 3.2 Fit Scoring

**Algorithm (total: 100 pts)**

| Dimension | Weight | Signal |
|-----------|--------|--------|
| Role relevance | 40% | Target roles vs job title token overlap |
| Skills match | 35% | User skills vs job requirements / description |
| Seniority match | 25% | User seniority vs inferred job seniority |

**Hard floor:** Jobs scoring below 50% are hidden from the feed by default (filter can be lowered manually).

**Score display:** Percentage + short explanation sentence (e.g., "Strong match on PM skills; slight seniority mismatch").

---

### 3.3 AI Application Packet Generation

**3.3.1 Job Intelligence (claude-opus-4-6, tool_use)**

Input: job title, description, requirements, user profile (title, years, skills, LinkedIn About).

Output (`analyze_job` tool):
- `roleSynthesis` — 2–3 sentence synthesis of what the role actually requires
- `hiddenScorecard[]` — criteria implied but not stated; each with dealbreaker flag
- `rankedBullets[]` — user's bullets reranked + rewritten for this specific role
- `coverLetterAngle` — recommended framing angle
- `keywords[]` — ATS/JD keywords to include

**3.3.2 Cover Letter Generation (claude-opus-4-6)**

Uses job intelligence output when available:
- Adopts `coverLetterAngle` as the opening hook
- Uses rewritten bullets from `rankedBullets` instead of raw user bullets
- Injects `keywords` into body naturally
- Includes LinkedIn About context when provided
- ~250–350 words, professional tone

**3.3.3 Verifier**
After generation, a rule-based verifier checks:
- No hallucinated company facts
- No first-person exaggeration flags
- Keyword coverage
- Issues / warnings stored on Application record (`verifierReport`)

**3.3.4 Common Question Auto-Answers**
Pre-fills standard screening questions (years of experience, work authorization, salary expectations, availability) from profile data. Stored as `customAnswers` JSON.

---

### 3.4 Resume Pack *(built, UI pending)*

**`generateResumePack()` (claude-opus-4-6, tool_use)**

Input: job, user profile (with LinkedIn About), bullets sorted by proof strength.

Output (`generate_resume_pack` tool):
- `headline` — role-specific LinkedIn/resume headline
- `summary` — 3–4 sentence professional summary tailored to the JD
- `bullets[]` — 6–8 most relevant bullets, each with original, rewritten, improvement note
- `keywords[]` — ATS keywords to include
- `notes` — strategic application notes

Status: API route and UI not yet wired; generation logic is complete in `src/lib/ai/resume-pack.ts`.

---

### 3.5 Application Tracking

**Statuses:**
| Status | Meaning |
|--------|---------|
| PREPARED | AI packet generated; awaiting user review |
| APPLIED | User approved (or auto-apply sent) |
| INTERVIEWING | User manually updated |
| OFFER | User manually updated |
| REJECTED | User manually updated or auto-rejected |

**Queue view:** Filters by status; sortable by fit score and date.

**Review Panel:** Full cover letter view with inline editing; Job Intelligence card visible after generate runs.

---

### 3.6 Dashboard

**KPIs (top row):**
- **In Queue** — count of PREPARED applications
- **In Flight** — count of APPLIED applications
- **Offers** — count of OFFER applications
- **Response Rate** — `(INTERVIEWING + OFFER) / totalSent × 100%`; shown only when totalSent ≥ 3

**Scan Status Bar:**
- Last scan time (human-readable relative time)
- Countdown to next 6 AM scan
- "Scan Now" quick-trigger button

**Stale Queue Warning:**
- Orange banner if oldest PREPARED application is > 5 days old
- Prompts user to review or clear stale items

---

### 3.7 Job Feed (Discover)

- Displays ACTIVE jobs not yet in the user's application queue.
- Default fit filter: ≥ 50% (configurable down to 0%).
- Filter badge shows active state when filter deviates from default.
- Sortable by: date, fit score.

---

### 3.8 Settings

**Professional Profile**
- Current title, years of experience
- Target roles (multi-value tag input)
- Skills (multi-value tag input)
- Industries (multi-value tag input)
- Work authorization
- LinkedIn URL
- **LinkedIn About** — long-form textarea (up to 3,000 chars) for pasting LinkedIn bio; fed into AI context for richer, more personalized generation
- GitHub URL, portfolio URL

**Search Profile**
- Target roles, seniority, locations
- Daily job limit
- LinkedIn search URLs (one per line)
- RSS feed URLs (one per line)
- Auto-prep toggle (default: on)
- Auto-apply toggle (default: off) + threshold slider

**Notifications**
- **Daily Scan Digest** toggle — email sent after each overnight prepare run; opt-out stored as `digestEnabled` on UserProfile

**Account**
- Email, name, member since (read-only)

---

### 3.9 Email Digest

Triggered by the 7 AM prepare cron, after each user's packets are generated.

**Conditions:** `userPrepared > 0` AND `user.userProfile.digestEnabled !== false`

**Content:**
- Number of new applications prepared
- Total in queue
- Top 3 jobs by fit score (title, company, score)
- CTA button → Review Queue

**Sender:** `RESEND_FROM_EMAIL` env var (default: `noreply@stealthscan.app`)

---

## 4. Technical Architecture

### 4.1 Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL via Neon (serverless) |
| ORM | Prisma 6 |
| Auth | Clerk |
| AI | Anthropic claude-opus-4-6 (tool_use) |
| Email | Resend |
| File upload | UploadThing |
| Scraping | Apify |
| Hosting | Vercel |
| UI | shadcn/ui + Tailwind CSS v4 |

### 4.2 Database Migrations
Migrations are applied automatically at deploy time via `prisma migrate deploy` in the build script. No manual DB access is required.

### 4.3 Cron Authentication
All cron endpoints require `Authorization: Bearer {CRON_SECRET}`. Vercel cron sends this header automatically.

### 4.4 Key Environment Variables
```
DATABASE_URL
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ANTHROPIC_API_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
UPLOADTHING_TOKEN
APIFY_API_TOKEN
CRON_SECRET
```

---

## 5. Known Limitations (v1)

| Limitation | Notes |
|-----------|-------|
| Resume pack UI not wired | Backend complete; requires API route + ReviewPanel modal |
| Cover letter editing is client-side only | Edits are not persisted to the database |
| Single active search profile per user | Multiple profile support is schema-ready but not exposed in UI |
| No browser-based job application | Auto-apply marks status only; does not submit via browser automation |
| LinkedIn scraping rate limits | Apify actor subject to LinkedIn rate limits; large URL lists may yield partial results |
| No mobile-optimized layout | Responsive but not mobile-first |
| No team / recruiter view | Single-user product only |

---

## 6. Out of Scope (v1)

- Browser automation for actual job submission
- ATS integrations (Greenhouse, Lever, Workday)
- Interview preparation features
- Salary benchmarking
- Referral network / contact mapping
- Team/agency accounts
- Mobile app

---

## 7. Success Metrics

| Metric | Target (90-day) |
|--------|----------------|
| Applications prepared per active user / week | ≥ 10 |
| Cover letter generation success rate | ≥ 95% |
| User review rate (opens review panel) | ≥ 60% of prepared items |
| Response rate (interviews / applied) | ≥ 15% |
| Digest email open rate | ≥ 40% |
| D7 retention (returns within 7 days) | ≥ 50% |

---

## 8. Roadmap Candidates (Post-v1)

1. **Resume Pack UI** — Generate role-tailored headline, summary, and bullets from the Review Panel
2. **Cover letter persistence** — Save edited cover letters back to the application record
3. **Multiple search profiles** — Support separate profiles for different role tracks
4. **Browser-based auto-apply** — Playwright integration for supported ATS platforms
5. **Interview prep mode** — AI-generated Q&A based on JD and user background
6. **Outreach templates** — Cold LinkedIn messages and email follow-ups
