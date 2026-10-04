// Below-the-fold chapters, split into their own chunk (loaded by LazyChapter near the viewport).
import React from 'react';
import { Chapter } from './Chapter';
import { WeatherSatelliteSection } from '../WeatherSatelliteSection';
import { CameraNetworkSection } from '../CameraNetworkSection';
import { HumanInTheLoopSection } from '../HumanInTheLoopSection';
import { PlaceIntelligenceSection } from '../PlaceIntelligenceSection';
import { SimulationSection } from '../SimulationSection';
import { MobileJourneySection } from '../MobileJourneySection';
import { AdminCommandPreview } from '../AdminCommandPreview';
import { LandingFooter } from '../LandingFooter';

export const WeatherChapter: React.FC = () => (
  <Chapter id="weather" index="03" name="WATCH THE REGION" mood="storm" variant="sheet">
    <WeatherSatelliteSection />
  </Chapter>
);

export const CamerasChapter: React.FC = () => (
  <Chapter id="cameras" index="04" name="PUT EYES ON THE GROUND" mood="navy">
    <CameraNetworkSection />
  </Chapter>
);

export const HumanChapter: React.FC = () => (
  <Chapter id="human" index="05" name="AI DETECTS, HUMANS DECIDE" mood="navy" variant="sheet">
    <HumanInTheLoopSection />
  </Chapter>
);

export const PlacesChapter: React.FC = () => (
  <Chapter id="places" index="06" name="EVERY PLACE IS DIFFERENT" mood="navy" variant="sheet">
    <PlaceIntelligenceSection />
  </Chapter>
);

export const SimulationChapter: React.FC = () => (
  <Chapter id="simulation" index="07" name="WHAT HAPPENS IF" mood="navy">
    <SimulationSection />
  </Chapter>
);

export const JourneyChapter: React.FC = () => (
  <Chapter id="mobile-journey" index="08" name="THE CITIZEN'S JOURNEY" mood="navy" variant="sheet">
    <MobileJourneySection />
  </Chapter>
);

export const CommandChapter: React.FC = () => (
  <Chapter id="command" index="09" name="THE COMMAND CENTER" mood="navy">
    <AdminCommandPreview />
  </Chapter>
);

export const EpilogueChapter: React.FC = () => (
  <Chapter id="epilogue" index="EPILOGUE" name="SEE THE FLOOD BEFORE IT REACHES TOWN" mood="dawn">
    <LandingFooter />
  </Chapter>
);
