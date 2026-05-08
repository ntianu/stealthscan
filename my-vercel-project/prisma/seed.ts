/**
 * Seed script — populates the DB with realistic demo data.
 * Run with: npx tsx prisma/seed.ts
 */
import path from "path";
import { config } from "dotenv";
// Load env before Prisma client initializes
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const USER_CLERK_ID = "user_3AXs4gP2G7tQfkJxGuIu4Tm0Lxw";

async function main() {
  // ── 1. Find or create the user ──────────────────────────────────────────────
  const user = await db.user.findUniqueOrThrow({ where: { clerkId: USER_CLERK_ID } });
  console.log(`Seeding for user: ${user.email} (${user.id})`);

  // ── 2. UserProfile ──────────────────────────────────────────────────────────
  await db.userProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      yearsExperience: 5,
      currentTitle: "Senior Software Engineer",
      targetRoles: ["Software Engineer", "Staff Engineer", "Tech Lead"],
      skills: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Docker", "AWS"],
      industries: ["SaaS", "Fintech", "Developer Tools"],
      workAuth: "citizen",
      linkedinUrl: "https://linkedin.com/in/ntianu",
      githubUrl: "https://github.com/ntianu",
    },
  });

  // ── 3. Resumes ──────────────────────────────────────────────────────────────
  const resume = await db.resume.create({
    data: {
      userId: user.id,
      name: "Full-Stack Resume 2025",
      fileUrl: "https://example.com/resumes/fullstack.pdf",
      fileKey: "resumes/fullstack.pdf",
      roleTags: ["engineer", "fullstack", "frontend"],
      domains: ["saas", "fintech"],
      seniority: "SENIOR",
      isDefault: true,
      active: true,
    },
  });

  const resume2 = await db.resume.create({
    data: {
      userId: user.id,
      name: "Backend-Focused Resume",
      fileUrl: "https://example.com/resumes/backend.pdf",
      fileKey: "resumes/backend.pdf",
      roleTags: ["engineer", "backend", "api"],
      domains: ["devtools", "infra"],
      seniority: "SENIOR",
      isDefault: false,
      active: true,
    },
  });

  // ── 4. Bullets ──────────────────────────────────────────────────────────────
  const bulletData = [
    {
      content: "Reduced API latency by 62% by migrating to edge functions and implementing request coalescing, improving p95 response time from 820ms to 310ms across 40M daily requests.",
      competencyTags: ["performance", "backend", "architecture"],
      industryTags: ["saas", "infrastructure"],
      roleTags: ["software engineer", "backend engineer"],
      seniority: "SENIOR" as const,
      proofStrength: 5,
    },
    {
      content: "Led redesign of the checkout funnel for a $2B e-commerce platform, increasing conversion rate by 18% and reducing drop-off by 34% through A/B testing and iterative UX improvements.",
      competencyTags: ["product", "frontend", "analytics"],
      industryTags: ["ecommerce", "fintech"],
      roleTags: ["frontend engineer", "fullstack engineer"],
      seniority: "SENIOR" as const,
      proofStrength: 5,
    },
    {
      content: "Architected a multi-tenant SaaS platform from scratch serving 500+ enterprise customers, designing the schema, auth layer, and billing integration with a team of 3 engineers.",
      competencyTags: ["architecture", "backend", "leadership"],
      industryTags: ["saas", "b2b"],
      roleTags: ["software engineer", "staff engineer", "tech lead"],
      seniority: "SENIOR" as const,
      proofStrength: 5,
    },
    {
      content: "Shipped a real-time collaboration feature using CRDTs and WebSocket multiplexing, cutting document merge conflicts to zero while supporting 1,000+ concurrent editors.",
      competencyTags: ["realtime", "backend", "distributed systems"],
      industryTags: ["productivity", "saas"],
      roleTags: ["software engineer", "backend engineer"],
      seniority: "MID" as const,
      proofStrength: 4,
    },
    {
      content: "Mentored 4 junior engineers through structured pair programming and weekly design reviews, two of whom were promoted to mid-level within 12 months.",
      competencyTags: ["mentorship", "leadership", "engineering culture"],
      industryTags: ["saas"],
      roleTags: ["tech lead", "senior engineer", "staff engineer"],
      seniority: "SENIOR" as const,
      proofStrength: 3,
    },
    {
      content: "Built a CI/CD pipeline on GitHub Actions reducing deploy time from 18 minutes to 4 minutes and enabling trunk-based development across 12 engineers.",
      competencyTags: ["devops", "ci/cd", "dx"],
      industryTags: ["developer tools", "saas"],
      roleTags: ["software engineer", "devops engineer"],
      seniority: "MID" as const,
      proofStrength: 4,
    },
  ];

  await db.bullet.createMany({ data: bulletData.map((b) => ({ ...b, userId: user.id })) });
  console.log(`Created ${bulletData.length} bullets`);

  // ── 5. Jobs ─────────────────────────────────────────────────────────────────
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  const jobs = await Promise.all([
    db.job.create({
      data: {
        source: "GREENHOUSE",
        externalId: "gh-001",
        dedupKey: "gh-001-stripe",
        title: "Senior Software Engineer, Payments Infrastructure",
        company: "Stripe",
        location: "San Francisco, CA",
        remoteType: "HYBRID",
        salaryMin: 180000,
        salaryMax: 260000,
        description: "Join Stripe's Payments Infrastructure team to build the systems that move money for millions of businesses worldwide. You'll work on high-throughput distributed systems that require five-nines reliability.",
        requirements: ["TypeScript", "Go", "distributed systems", "5+ years experience"],
        applyUrl: "https://greenhouse.io/jobs/stripe-001",
        postedAt: daysAgo(5),
        fetchedAt: daysAgo(2),
        status: "ACTIVE",
      },
    }),
    db.job.create({
      data: {
        source: "LEVER",
        externalId: "lv-002",
        dedupKey: "lv-002-linear",
        title: "Software Engineer, Product",
        company: "Linear",
        location: "Remote",
        remoteType: "REMOTE",
        salaryMin: 160000,
        salaryMax: 220000,
        description: "Linear is building the new standard for software project management. We're looking for engineers who care deeply about craftsmanship, speed, and user experience.",
        requirements: ["React", "TypeScript", "Node.js", "3+ years experience"],
        applyUrl: "https://lever.co/jobs/linear-002",
        postedAt: daysAgo(3),
        fetchedAt: daysAgo(1),
        status: "ACTIVE",
      },
    }),
    db.job.create({
      data: {
        source: "GREENHOUSE",
        externalId: "gh-003",
        dedupKey: "gh-003-vercel",
        title: "Staff Engineer, Developer Experience",
        company: "Vercel",
        location: "Remote",
        remoteType: "REMOTE",
        salaryMin: 200000,
        salaryMax: 280000,
        description: "Vercel is looking for a Staff Engineer to lead the Developer Experience team. You'll shape the tools, frameworks, and workflows that millions of developers use every day.",
        requirements: ["Next.js", "TypeScript", "Rust", "7+ years experience", "systems design"],
        applyUrl: "https://greenhouse.io/jobs/vercel-003",
        postedAt: daysAgo(7),
        fetchedAt: daysAgo(3),
        status: "ACTIVE",
      },
    }),
    db.job.create({
      data: {
        source: "LINKEDIN",
        externalId: "li-004",
        dedupKey: "li-004-notion",
        title: "Senior Frontend Engineer",
        company: "Notion",
        location: "New York, NY",
        remoteType: "HYBRID",
        salaryMin: 170000,
        salaryMax: 230000,
        description: "Notion is building the all-in-one workspace. We're looking for a senior frontend engineer to work on our core editor experience, making it faster, more reliable, and more delightful.",
        requirements: ["React", "TypeScript", "CRDTs", "performance optimization", "4+ years"],
        applyUrl: "https://linkedin.com/jobs/notion-004",
        postedAt: daysAgo(10),
        fetchedAt: daysAgo(4),
        status: "ACTIVE",
      },
    }),
    db.job.create({
      data: {
        source: "WTTJ",
        externalId: "wttj-005",
        dedupKey: "wttj-005-alan",
        title: "Software Engineer, Backend",
        company: "Alan",
        location: "Paris, France",
        remoteType: "HYBRID",
        salaryMin: 65000,
        salaryMax: 95000,
        description: "Alan is reinventing health insurance in Europe. We're looking for a backend engineer to help build the systems that power our insurance products.",
        requirements: ["Python", "PostgreSQL", "API design", "3+ years"],
        applyUrl: "https://welcometothejungle.com/jobs/alan-005",
        postedAt: daysAgo(6),
        fetchedAt: daysAgo(2),
        status: "ACTIVE",
      },
    }),
    db.job.create({
      data: {
        source: "INDEED",
        externalId: "in-006",
        dedupKey: "in-006-ramp",
        title: "Senior Full-Stack Engineer",
        company: "Ramp",
        location: "New York, NY",
        remoteType: "ONSITE",
        salaryMin: 190000,
        salaryMax: 250000,
        description: "Ramp is the fastest-growing B2B fintech in the US. We're building a finance automation platform that helps businesses save time and money.",
        requirements: ["TypeScript", "React", "Python", "PostgreSQL", "fintech experience preferred"],
        applyUrl: "https://indeed.com/jobs/ramp-006",
        postedAt: daysAgo(2),
        fetchedAt: daysAgo(1),
        status: "ACTIVE",
      },
    }),
    db.job.create({
      data: {
        source: "GREENHOUSE",
        externalId: "gh-007",
        dedupKey: "gh-007-figma",
        title: "Software Engineer, Infrastructure",
        company: "Figma",
        location: "San Francisco, CA",
        remoteType: "HYBRID",
        salaryMin: 175000,
        salaryMax: 245000,
        description: "Figma is building the future of design tools. Our infrastructure team makes Figma fast, reliable, and scalable for millions of designers worldwide.",
        requirements: ["Go", "Kubernetes", "distributed systems", "reliability engineering"],
        applyUrl: "https://greenhouse.io/jobs/figma-007",
        postedAt: daysAgo(14),
        fetchedAt: daysAgo(7),
        status: "ACTIVE",
      },
    }),
    db.job.create({
      data: {
        source: "LEVER",
        externalId: "lv-008",
        dedupKey: "lv-008-retool",
        title: "Senior Engineer, Platform",
        company: "Retool",
        location: "San Francisco, CA",
        remoteType: "ONSITE",
        salaryMin: 165000,
        salaryMax: 225000,
        description: "Retool is rebuilding how software is made. Our platform team owns the core infrastructure powering the internal tools of the world's best companies.",
        requirements: ["TypeScript", "React", "Node.js", "GraphQL", "4+ years"],
        applyUrl: "https://lever.co/jobs/retool-008",
        postedAt: daysAgo(8),
        fetchedAt: daysAgo(3),
        status: "ACTIVE",
      },
    }),
  ]);
  console.log(`Created ${jobs.length} jobs`);

  // ── 6. Applications ─────────────────────────────────────────────────────────
  const coverLetter = (company: string, role: string) => `Dear ${company} Hiring Team,

I'm excited to apply for the ${role} position. With 5 years of experience building high-scale TypeScript/Node.js systems, I believe I can make an immediate impact on your team.

At my previous company, I led a team of 4 engineers to redesign our core API layer, reducing latency by 62% and enabling a 3× increase in throughput. I'm particularly drawn to ${company}'s approach to product craftsmanship and the technical challenges at your scale.

I'd love to discuss how my background aligns with what you're building. Looking forward to connecting.

Best,
Ntianu`;

  const fitExplanation = (score: number) =>
    score >= 70
      ? "Strong match across all key criteria: seniority level, tech stack, remote preference, and compensation range. The role requirements closely mirror your profile skills."
      : score >= 50
      ? "Moderate match. Your core skills align well but there are a few requirements (e.g. Go, Kubernetes) outside your primary stack. Worth applying with a tailored cover letter."
      : "Partial match. The role has several requirements that differ significantly from your profile. Consider whether you want to invest time in this application.";

  const apps = [
    // SUBMITTED — Linear
    {
      jobId: jobs[1].id, // Linear
      resumeId: resume.id,
      status: "SUBMITTED" as const,
      fitScore: 88,
      fitExplanation: fitExplanation(88),
      coverLetter: coverLetter("Linear", "Software Engineer, Product"),
      customAnswers: { "Why Linear?": "I've used Linear daily for 2 years and admire the obsession with speed and simplicity.", "Years of React experience?": "5 years" },
      submittedAt: daysAgo(3),
      createdAt: daysAgo(5),
    },
    // SUBMITTED — Notion
    {
      jobId: jobs[3].id, // Notion
      resumeId: resume.id,
      status: "SUBMITTED" as const,
      fitScore: 82,
      fitExplanation: fitExplanation(82),
      coverLetter: coverLetter("Notion", "Senior Frontend Engineer"),
      customAnswers: { "CRDT experience?": "Yes — built a collaborative editor at my last company using Yjs." },
      submittedAt: daysAgo(6),
      createdAt: daysAgo(8),
    },
    // RESPONDED — Ramp (positive!)
    {
      jobId: jobs[5].id, // Ramp
      resumeId: resume.id,
      status: "RESPONDED" as const,
      fitScore: 91,
      fitExplanation: fitExplanation(91),
      coverLetter: coverLetter("Ramp", "Senior Full-Stack Engineer"),
      customAnswers: { "Fintech experience?": "Yes — 2 years at a payments startup handling PCI-compliant card data." },
      submittedAt: daysAgo(4),
      responseAt: daysAgo(1),
      responseType: "interview",
      createdAt: daysAgo(6),
    },
    // APPROVED (ready to submit) — Stripe
    {
      jobId: jobs[0].id, // Stripe
      resumeId: resume.id,
      status: "APPROVED" as const,
      fitScore: 76,
      fitExplanation: fitExplanation(76),
      coverLetter: coverLetter("Stripe", "Senior Software Engineer, Payments Infrastructure"),
      customAnswers: { "Go experience?": "Familiar but not primary — primary stack is TypeScript/Node." },
      createdAt: daysAgo(1),
    },
    // PREPARED — Vercel
    {
      jobId: jobs[2].id, // Vercel
      resumeId: resume.id,
      status: "PREPARED" as const,
      fitScore: 94,
      fitExplanation: fitExplanation(94),
      coverLetter: coverLetter("Vercel", "Staff Engineer, Developer Experience"),
      createdAt: daysAgo(0),
    },
    // REJECTED — Figma
    {
      jobId: jobs[6].id, // Figma
      resumeId: resume2.id,
      status: "SUBMITTED" as const,
      fitScore: 54,
      fitExplanation: fitExplanation(54),
      coverLetter: coverLetter("Figma", "Software Engineer, Infrastructure"),
      submittedAt: daysAgo(12),
      createdAt: daysAgo(14),
    },
    // SUBMITTED — Retool
    {
      jobId: jobs[7].id, // Retool
      resumeId: resume.id,
      status: "SUBMITTED" as const,
      fitScore: 79,
      fitExplanation: fitExplanation(79),
      coverLetter: coverLetter("Retool", "Senior Engineer, Platform"),
      submittedAt: daysAgo(5),
      createdAt: daysAgo(7),
    },
    // PREPARED — Alan
    {
      jobId: jobs[4].id, // Alan
      resumeId: resume2.id,
      status: "PREPARED" as const,
      fitScore: 61,
      fitExplanation: fitExplanation(61),
      createdAt: daysAgo(0),
    },
  ];

  for (const app of apps) {
    const { createdAt, ...rest } = app;
    await db.application.create({
      data: {
        userId: user.id,
        ...rest,
        createdAt,
      },
    });
  }
  console.log(`Created ${apps.length} applications`);

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
