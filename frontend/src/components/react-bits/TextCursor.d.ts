import React from 'react';

export interface TextCursorProps {
  text?: string;
  spacing?: number;
  followMouseDirection?: boolean;
  randomFloat?: boolean;
  exitDuration?: number;
  removalInterval?: number;
  maxPoints?: number;
}

declare const TextCursor: React.FC<TextCursorProps>;
export default TextCursor;
