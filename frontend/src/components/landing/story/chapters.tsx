// Chapter compositions (section content + story chapter wrapper). The first two load with the page;
// the rest live in lazyChapters.tsx and are fetched as the visitor approaches them.
import React from 'react';
import { Chapter } from './Chapter';
import { MountainSection } from '../MountainSection';
import { SignalsConvergenceSection } from '../SignalsConvergenceSection';

export const MountainChapter: React.FC = () => (
  <Chapter id="mountain" index="01" name="THE MOUNTAIN" mood="storm" variant="sheet">
    <MountainSection />
  </Chapter>
);

export const SignalsChapter: React.FC = () => (
  <Chapter id="signals" index="02" name="ONE FLOOD, MANY SIGNALS" mood="storm">
    <SignalsConvergenceSection />
  </Chapter>
);
