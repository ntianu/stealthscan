"use client";

import { UserButton } from "@clerk/nextjs";

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <UserButton />
    </header>
  );
}
