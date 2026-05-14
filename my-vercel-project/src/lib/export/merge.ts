/**
 * Merge a ResumePack (AI-generated rewrites) into a ResumeStructure (parsed master).
 *
 * Rules:
 *   - headline: pack.headline replaces contact.headline (always)
 *   - summary: pack.summary replaces resume.summary; if no summary existed, inject one
 *   - bullets: for each pack.bullets entry, find the matching bullet in the master
 *     by `original` text (using progressively looser matching) and replace `text`
 *     with `rewritten`, marking the bullet as `rewritten: true` and storing
 *     `originalText` for audit/diff. Unmatched rewrites get appended to a
 *     synthetic "Highlights" section so they aren't lost.
 *   - keywords: not injected automatically — the rewrites should already use them.
 *     Renderers may optionally append a small "Keywords" line at the bottom.
 */

import type {
  MergeResult,
  ResumePackInput,
  ResumeStructure,
  StructuredBullet,
} from "./types";

/** Normalize a bullet for fuzzy matching. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/^\d+\.\s*/, "") // strip leading list numbering
    .replace(/^[•·\-*▪◦‣→]\s*/, "") // strip bullet marker
    .replace(/\s+\[tags:[^\]]*\]$/, "") // strip our [tags: ...] suffix
    .replace(/[^\w\s]/g, " ") // drop punctuation
    .replace(/\s+/g, " ")
    .trim();
}

interface BulletAddress {
  experienceIndex: number;
  bulletIndex: number;
}

/** Build an index of every bullet across all experience items, keyed by normalized text. */
function indexBullets(resume: ResumeStructure): Map<string, BulletAddress> {
  const map = new Map<string, BulletAddress>();
  resume.experience.forEach((exp, eIdx) => {
    exp.bullets.forEach((b, bIdx) => {
      const key = normalize(b.text);
      if (key && !map.has(key)) {
        map.set(key, { experienceIndex: eIdx, bulletIndex: bIdx });
      }
    });
  });
  return map;
}

/** Find a bullet address by trying exact → prefix → substring matches. */
function findBulletAddress(
  packOriginal: string,
  bulletIndex: Map<string, BulletAddress>
): BulletAddress | null {
  const target = normalize(packOriginal);
  if (!target) return null;

  // Exact match
  const exact = bulletIndex.get(target);
  if (exact) return exact;

  // Prefix match: AI may have truncated the bullet
  for (const [key, addr] of bulletIndex) {
    if (key.startsWith(target.slice(0, 40)) && target.length >= 20) return addr;
  }

  // Substring match either direction
  for (const [key, addr] of bulletIndex) {
    if (target.length > 30 && (key.includes(target.slice(0, 30)) || target.includes(key.slice(0, 30)))) {
      return addr;
    }
  }

  return null;
}

export function mergePackIntoStructure(
  resume: ResumeStructure,
  pack: ResumePackInput
): MergeResult {
  // Deep-clone-ish: we mutate copies to avoid surprising callers.
  const merged: ResumeStructure = {
    ...resume,
    contact: { ...resume.contact },
    experience: resume.experience.map((e) => ({
      ...e,
      bullets: e.bullets.map((b) => ({ ...b })),
    })),
    education: resume.education.map((e) => ({ ...e, details: e.details ? [...e.details] : undefined })),
    skills: resume.skills.map((s) => ({ ...s, items: [...s.items] })),
    other: resume.other.map((o) => ({ ...o, lines: [...o.lines] })),
    meta: { ...resume.meta, parseWarnings: [...resume.meta.parseWarnings] },
  };

  // 1. Headline
  if (pack.headline?.trim()) {
    merged.contact.headline = pack.headline.trim();
  }

  // 2. Summary
  if (pack.summary?.trim()) {
    merged.summary = pack.summary.trim();
  }

  // 3. Bullet rewrites
  const bulletIndex = indexBullets(merged);
  const usedAddresses = new Set<string>();
  const appliedBullets: MergeResult["appliedBullets"] = [];
  const unmatchedBullets: MergeResult["unmatchedBullets"] = [];

  for (const item of pack.bullets) {
    const addr = findBulletAddress(item.original, bulletIndex);
    const addrKey = addr ? `${addr.experienceIndex}:${addr.bulletIndex}` : null;

    if (!addr || (addrKey && usedAddresses.has(addrKey))) {
      unmatchedBullets.push({ original: item.original, rewritten: item.rewritten });
      continue;
    }

    const exp = merged.experience[addr.experienceIndex];
    const bullet = exp.bullets[addr.bulletIndex];
    const replacement: StructuredBullet = {
      text: item.rewritten,
      rewritten: true,
      originalText: bullet.text,
    };
    exp.bullets[addr.bulletIndex] = replacement;
    usedAddresses.add(addrKey!);
    appliedBullets.push({
      original: item.original,
      rewritten: item.rewritten,
      matchedAt: `${exp.title || "Role"} @ ${exp.company || "—"}`,
    });
  }

  // 4. Spill unmatched rewrites into a Highlights section so they aren't lost
  let injectedHighlights = false;
  if (unmatchedBullets.length > 0) {
    merged.other.unshift({
      heading: "Highlights",
      lines: unmatchedBullets.map((u) => u.rewritten),
    });
    injectedHighlights = true;
  }

  return {
    resume: merged,
    appliedBullets,
    unmatchedBullets,
    injectedHighlights,
  };
}
