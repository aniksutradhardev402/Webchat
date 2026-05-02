"use client";

import React, { useState } from "react";

interface Props {
  content: string;
  currentUsername?: string;
}

/**
 * Renders message content with:
 * - @mention highlighting (amber for self, primary for others)
 * - Copy-to-clipboard button on hover
 */
export function MessageContent({ content, currentUsername }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // Tokenise the content into plain text and @mention spans
  const parts = content.split(/(@\w+)/g);
  const rendered = parts.map((part, i) => {
    if (!part.startsWith("@")) return <span key={i}>{part}</span>;
    const mentioned = part.slice(1);
    const isSelf = currentUsername && mentioned.toLowerCase() === currentUsername.toLowerCase();
    return (
      <mark
        key={i}
        className={`rounded px-0.5 font-semibold not-italic ${
          isSelf
            ? "bg-yellow-400/30 text-yellow-200"
            : "bg-primary/20 text-primary"
        }`}
      >
        {part}
      </mark>
    );
  });

  return (
    <div className="group/msg relative">
      <p className="text-sm leading-relaxed">{rendered}</p>
      {/* Copy button — visible on hover */}
      <button
        onClick={handleCopy}
        aria-label="Copy message"
        className="absolute -top-2 -right-2 opacity-0 group-hover/msg:opacity-100 transition-opacity
                   bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10
                   rounded-full w-6 h-6 flex items-center justify-center text-[10px] shadow"
      >
        {copied ? "✓" : "📋"}
      </button>
    </div>
  );
}
