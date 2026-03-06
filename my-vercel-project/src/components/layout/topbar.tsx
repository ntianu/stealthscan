"use client";

import { UserButton } from "@clerk/nextjs";

interface TopbarProps {
  title: string;
  description?: string;
}

export function Topbar({ title, description }: TopbarProps) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-white/[0.06] bg-background/80 backdrop-blur-sm px-6">
      <div>
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{description}</p>
        )}
      </div>
      <UserButton
        appearance={{
          elements: {
            avatarBox: "h-7 w-7",
          },
        }}
      />
    </header>
  );
}
