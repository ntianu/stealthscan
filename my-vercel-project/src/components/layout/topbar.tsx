"use client";

import { UserButton } from "@clerk/nextjs";

interface TopbarProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function Topbar({ title, description, action }: TopbarProps) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-white/[0.06] bg-background/80 backdrop-blur-sm px-6">
      <div>
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {action}
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-7 w-7",
            },
          }}
        />
      </div>
    </header>
  );
}
