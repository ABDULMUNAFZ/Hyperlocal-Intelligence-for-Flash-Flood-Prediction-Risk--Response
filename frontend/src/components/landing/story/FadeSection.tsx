// Fades a block in as it scrolls into view (opacity + rise + un-blur). Purely presentational.
import React from 'react';

export const FadeSection: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div data-reveal className={className}>{children}</div>
);

export default FadeSection;
