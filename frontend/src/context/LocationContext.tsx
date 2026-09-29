// Location Context for FloodGuard
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LocationContextType {
  latitude: number;
  longitude: number;
  setLocation: (lat: number, lon: number) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [latitude, setLatitude] = useState(10.5); // Default to Kerala
  const [longitude, setLongitude] = useState(76.5);

  const setLocation = (lat: number, lon: number) => {
    setLatitude(lat);
    setLongitude(lon);
  };

  return (
    <LocationContext.Provider value={{ latitude, longitude, setLocation }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
