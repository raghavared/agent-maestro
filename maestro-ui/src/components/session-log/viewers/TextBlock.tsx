import React from 'react';

interface TextBlockProps {
  text: string;
}

export function TextBlock({ text }: TextBlockProps) {
  if (!text.trim()) return null;
  return (
    <div className="sessionLogTextBlock">
      {text}
    </div>
  );
}
