// Consistent chapter header: mono eyebrow pill, Space Grotesk headline with a masked word reveal,
// an italic accent line, and one Manrope paragraph.
import React from 'react';
import { RevealText } from './RevealText';

interface Props {
  eyebrow?: string;
  accent?: string;
  title: string;
  italic?: string;
  body?: string;
  theme?: 'light' | 'dark';
  className?: string;
}

export const ChapterHeader: React.FC<Props> = ({ eyebrow, accent, title, italic, body, theme = 'light', className = '' }) => {
  const dark = theme === 'dark';
  return (
    <div className={`relative mb-12 max-w-3xl space-y-4 ${className}`} data-reveal>
      {eyebrow && (
        <div className="flex flex-wrap items-center gap-2">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${dark ? 'border border-white/15 bg-white/10 text-white backdrop-blur-md' : 'border border-[#DDD9CE] bg-white text-[#23252A]'}`}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D4F826] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#9BBD00]" />
            </span>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">{eyebrow}</span>
          </div>
          {accent && (
            <span className={`hidden border-l pl-2 font-mono text-[10px] sm:inline ${dark ? 'border-white/20 text-slate-400' : 'border-[#DDD9CE] text-[#7A7D87]'}`}>{accent}</span>
          )}
        </div>
      )}
      <RevealText
        as="h2"
        text={title}
        className={`font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl ${dark ? 'text-white' : 'text-[#181A1E]'}`}
      />
      {italic && (
        <RevealText
          as="div"
          text={italic}
          className={`font-serif text-2xl italic sm:text-4xl ${dark ? 'text-[#D4F826]' : 'text-[#4A4740]'}`}
        />
      )}
      {body && (
        <p className={`max-w-2xl pt-1 font-editorial text-base leading-relaxed sm:text-lg ${dark ? 'text-slate-300' : 'text-[#52555E]'}`}>{body}</p>
      )}
    </div>
  );
};

export default ChapterHeader;
