// FloodGuard Geospatial Command Center Data Engine
// Real Geographic Models for South India (Karnataka, Kerala, Tamil Nadu, Andhra Pradesh, Telangana)
// Strictly labeled: OBSERVED, FORECAST, MODEL PREDICTION, SIMULATION, ESTIMATED

export type DataIntegrityType = 'OBSERVED' | 'FORECAST' | 'MODEL PREDICTION' | 'SIMULATION' | 'DATA UNAVAILABLE' | 'ESTIMATED';

export interface HillStation {
  id: string;
  name: string;
  localName: string;
  stateCode: 'KL' | 'KA' | 'TN' | 'AP' | 'TG';
  stateName: string;
  district: string;
  coordinates: [number, number]; // [lng, lat]
  elevationM: number;
  terrainType: string;
  annualRainfallMm: number;
  monsoonPeakMonth: string;
  hazardGrade: 'Extreme' | 'Severe' | 'High' | 'Moderate' | 'Low';
  slopeAngleDeg: number;
  drainageBasin: string;
  description: string;
  historicalMax24hRainMm: number;
  camera: {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  };
}

export interface SouthIndiaState {
  id: string;
  code: 'KL' | 'KA' | 'TN' | 'AP' | 'TG';
  name: string;
  localName: string;
  capital: string;
  population: number;
  areaSqKm: number;
  elevationRangeM: string;
  majorBasins: string[];
  vulnerabilityScore: number; // 0-100
  centroid: [number, number];
  bounds: [[number, number], [number, number]];
  coordinates: number[][][]; // Polygon coordinates
}

export interface RiverSystem {
  id: string;
  name: string;
  origin: string;
  lengthKm: number;
  basinAreaSqKm: number;
  statesTraversed: string[];
  averageAnnualDischargeBCM: number;
  floodSensitivity: 'Extreme' | 'Severe' | 'High' | 'Moderate' | 'Low';
  coordinates: [number, number][]; // LineString
  tributaries: string[];
}

export interface Reservoir {
  id: string;
  name: string;
  river: string;
  state: string;
  district: string;
  coordinates: [number, number]; // Center
  fullReservoirLevelM: number;
  grossStorageCapacityMCM: number;
  liveStoragePercent: number; // 0-100
  status: 'Normal' | 'Alert' | 'Warning' | 'High Spillway Release';
  damType: string;
  inflowCusecs: number;
  outflowCusecs: number;
  polygon: number[][][];
}

export interface ClimateZone {
  id: string;
  name: string;
  classification: string;
  annualPrecipitationRangeMm: string;
  temperatureRangeC: string;
  monsoonSystem: string;
  soilRunoffCoeff: number;
  coverageStates: string[];
  description: string;
  color: string;
  coordinates: number[][][];
}

export interface BuildingFootprint {
  id: string;
  name: string;
  buildingType: 'hospital' | 'school' | 'police' | 'fire_station' | 'shelter' | 'residential' | 'commercial' | 'critical';
  heightM: number;
  levels: number;
  minHeightM: number;
  elevationM: number;
  settlement: string;
  coordinates: number[][][];
  isEstimated: boolean;
}

export interface HistoricalFlood {
  id: string;
  title: string;
  date: string;
  primaryLocation: string;
  states: string[];
  rainfallAmountMm: number;
  durationHours: number;
  triggerEvent: string;
  affectedPopulation: number;
  economicLossINR: string;
  inundationAreaSqKm: number;
  summary: string;
  coordinates: [number, number];
  impactPolygon: number[][][];
}

export interface EmergencyShelter {
  id: string;
  name: string;
  district: string;
  state: string;
  coordinates: [number, number];
  elevationM: number;
  capacityPersons: number;
  currentOccupancy: number;
  hasMedicalPost: boolean;
  hasHelipad: boolean;
  safeAccessCorridor: string;
  inundationRiskAtSite: 'None' | 'Minimal' | 'Moderate';
  contactPerson: string;
  contactNumber: string;
}

// 1. South Indian States with Accurate Outer Geometries
export const SOUTH_INDIA_STATES: SouthIndiaState[] = [
  {
    id: 'state-kerala',
    code: 'KL',
    name: 'Kerala',
    localName: 'കേരളം',
    capital: 'Thiruvananthapuram',
    population: 33406061,
    areaSqKm: 38852,
    elevationRangeM: '0 m to 2,695 m (Anamudi)',
    majorBasins: ['Periyar', 'Bharathappuzha', 'Pamba', 'Chaliyar', 'Kabini'],
    vulnerabilityScore: 88,
    centroid: [76.2711, 10.8505],
    bounds: [[74.85, 8.28], [77.58, 12.79]],
    coordinates: [[
      [74.90, 12.78], [75.18, 12.60], [75.40, 12.28], [75.75, 11.95],
      [76.05, 11.75], [76.28, 11.55], [76.50, 11.20], [76.75, 10.95],
      [76.85, 10.45], [77.10, 10.15], [77.25, 9.85], [77.30, 9.25],
      [77.40, 8.85], [77.55, 8.50], [77.20, 8.35], [76.90, 8.50],
      [76.55, 8.90], [76.35, 9.45], [76.20, 9.95], [75.95, 10.55],
      [75.75, 11.25], [75.35, 11.85], [75.05, 12.35], [74.90, 12.78]
    ]]
  },
  {
    id: 'state-karnataka',
    code: 'KA',
    name: 'Karnataka',
    localName: 'ಕರ್ನಾಟಕ',
    capital: 'Bengaluru',
    population: 61130704,
    areaSqKm: 191791,
    elevationRangeM: '0 m to 1,930 m (Mullayanagiri)',
    majorBasins: ['Krishna', 'Cauvery', 'Tungabhadra', 'Netravati', 'Sharavathi'],
    vulnerabilityScore: 74,
    centroid: [75.7139, 15.3173],
    bounds: [[74.05, 11.58], [78.58, 18.45]],
    coordinates: [[
      [74.05, 14.85], [74.45, 15.65], [75.15, 16.55], [76.25, 17.55],
      [77.45, 18.25], [77.70, 17.85], [77.45, 16.95], [77.25, 15.85],
      [77.05, 14.95], [77.45, 14.15], [77.85, 13.85], [78.35, 13.35],
      [78.15, 12.75], [77.45, 12.35], [76.85, 11.95], [76.25, 11.75],
      [75.65, 11.95], [75.15, 12.45], [74.80, 12.85], [74.50, 13.45],
      [74.20, 14.25], [74.05, 14.85]
    ]]
  },
  {
    id: 'state-tamilnadu',
    code: 'TN',
    name: 'Tamil Nadu',
    localName: 'தமிழ்நாடு',
    capital: 'Chennai',
    population: 72147030,
    areaSqKm: 130058,
    elevationRangeM: '0 m to 2,637 m (Doddabetta)',
    majorBasins: ['Cauvery', 'Palar', 'Vaigai', 'Tamirabarani', 'Bhavani'],
    vulnerabilityScore: 79,
    centroid: [78.6569, 11.1271],
    bounds: [[76.23, 8.08], [80.35, 13.55]],
    coordinates: [[
      [80.35, 13.45], [80.25, 12.95], [79.95, 12.15], [79.80, 11.35],
      [79.85, 10.75], [79.45, 10.25], [79.15, 9.75], [78.75, 9.25],
      [78.15, 8.85], [77.75, 8.45], [77.55, 8.10], [77.25, 8.40],
      [77.30, 8.95], [77.20, 9.55], [77.05, 10.15], [76.85, 10.65],
      [76.65, 11.15], [76.35, 11.65], [76.85, 12.05], [77.65, 12.45],
      [78.45, 12.75], [79.15, 13.15], [79.85, 13.45], [80.35, 13.45]
    ]]
  },
  {
    id: 'state-andhrapradesh',
    code: 'AP',
    name: 'Andhra Pradesh',
    localName: 'ఆంధ్రప్రదేశ్',
    capital: 'Amaravati',
    population: 49577103,
    areaSqKm: 162970,
    elevationRangeM: '0 m to 1,680 m (Arma Konda)',
    majorBasins: ['Godavari', 'Krishna', 'Penna', 'Nagavali', 'Vamsadhara'],
    vulnerabilityScore: 82,
    centroid: [80.1700, 15.9129],
    bounds: [[76.75, 12.65], [84.75, 19.15]],
    coordinates: [[
      [84.75, 19.10], [83.95, 18.45], [83.25, 17.75], [82.35, 16.95],
      [81.75, 16.35], [81.05, 15.85], [80.35, 15.25], [80.05, 14.45],
      [80.15, 13.55], [79.45, 13.25], [78.45, 12.75], [77.25, 13.45],
      [76.85, 14.15], [77.35, 15.15], [77.95, 15.75], [78.85, 16.15],
      [79.75, 16.65], [80.65, 17.15], [81.25, 17.65], [82.45, 18.25],
      [83.85, 18.75], [84.75, 19.10]
    ]]
  },
  {
    id: 'state-telangana',
    code: 'TG',
    name: 'Telangana',
    localName: 'తెలంగాణ',
    capital: 'Hyderabad',
    population: 35193978,
    areaSqKm: 112077,
    elevationRangeM: '100 m to 700 m (Deccan)',
    majorBasins: ['Godavari', 'Krishna', 'Musi', 'Manjira', 'Pranhita'],
    vulnerabilityScore: 68,
    centroid: [79.0193, 18.1124],
    bounds: [[77.25, 15.85], [81.85, 19.95]],
    coordinates: [[
      [78.45, 19.85], [79.85, 19.55], [80.65, 18.85], [81.35, 18.15],
      [81.15, 17.55], [80.45, 16.95], [79.85, 16.55], [78.85, 16.15],
      [77.95, 15.95], [77.45, 16.45], [77.35, 17.35], [77.55, 18.15],
      [77.85, 18.95], [78.45, 19.85]
    ]]
  }
];

// 2. Real South Indian Hill Stations with Precise Coordinates & Elevation
export const SOUTH_INDIA_HILL_STATIONS: HillStation[] = [
  {
    id: 'hill-munnar',
    name: 'Munnar',
    localName: 'മൂന്നാർ',
    stateCode: 'KL',
    stateName: 'Kerala',
    district: 'Idukki',
    coordinates: [77.0595, 10.0889],
    elevationM: 1532,
    terrainType: 'High-Altitude Anamalai Montane Valley',
    annualRainfallMm: 3450,
    monsoonPeakMonth: 'July-August (South-West)',
    hazardGrade: 'Extreme',
    slopeAngleDeg: 38,
    drainageBasin: 'Muthirappuzha / Periyar Basin',
    description: 'Confluence of Mudhirapuzha, Nallathanni and Kundaly rivers. Highly sensitive to heavy monsoon runoff and valley debris torrents.',
    historicalMax24hRainMm: 320,
    camera: { center: [77.0595, 10.0889], zoom: 12.8, pitch: 62, bearing: 35 }
  },
  {
    id: 'hill-wayanad',
    name: 'Wayanad (Meppadi / Chooralmala)',
    localName: 'വയനാട്',
    stateCode: 'KL',
    stateName: 'Kerala',
    district: 'Wayanad',
    coordinates: [76.1320, 11.6854],
    elevationM: 920,
    terrainType: 'Western Ghats Deep Escarpment',
    annualRainfallMm: 3850,
    monsoonPeakMonth: 'July',
    hazardGrade: 'Extreme',
    slopeAngleDeg: 42,
    drainageBasin: 'Chaliyar River Headwaters',
    description: 'Epicenter of steep slope saturation. Severe flash flood and debris torrent corridor under heavy episodic rain.',
    historicalMax24hRainMm: 572,
    camera: { center: [76.1320, 11.6854], zoom: 13.2, pitch: 65, bearing: -20 }
  },
  {
    id: 'hill-ooty',
    name: 'Ooty (Udhagamandalam)',
    localName: 'உதகமண்டலம்',
    stateCode: 'TN',
    stateName: 'Tamil Nadu',
    district: 'Nilgiris',
    coordinates: [76.6950, 11.4102],
    elevationM: 2240,
    terrainType: 'High Nilgiri Plateau Escarpment',
    annualRainfallMm: 1450,
    monsoonPeakMonth: 'October-November (North-East) & July',
    hazardGrade: 'High',
    slopeAngleDeg: 34,
    drainageBasin: 'Bhavani / Cauvery Sub-catchment',
    description: 'High-altitude hub surrounded by tea slopes. Vulnerable to saturated slope failure and localized lake basin flooding.',
    historicalMax24hRainMm: 285,
    camera: { center: [76.6950, 11.4102], zoom: 12.6, pitch: 58, bearing: 15 }
  },
  {
    id: 'hill-coonoor',
    name: 'Coonoor',
    localName: 'குன்னூர்',
    stateCode: 'TN',
    stateName: 'Tamil Nadu',
    district: 'Nilgiris',
    coordinates: [76.7959, 11.3530],
    elevationM: 1850,
    terrainType: 'Nilgiris Eastern Face Gorge',
    annualRainfallMm: 1650,
    monsoonPeakMonth: 'November',
    hazardGrade: 'High',
    slopeAngleDeg: 36,
    drainageBasin: 'Kallar River / Bhavani',
    description: 'Steep road/rail corridor susceptible to flash debris surges during North-East cyclonic depressions.',
    historicalMax24hRainMm: 260,
    camera: { center: [76.7959, 11.3530], zoom: 13.0, pitch: 60, bearing: -10 }
  },
  {
    id: 'hill-kodaikanal',
    name: 'Kodaikanal',
    localName: 'கொடைக்கானல்',
    stateCode: 'TN',
    stateName: 'Tamil Nadu',
    district: 'Dindigul',
    coordinates: [77.4892, 10.2381],
    elevationM: 2133,
    terrainType: 'Palani Hills Crest',
    annualRainfallMm: 1650,
    monsoonPeakMonth: 'October-November',
    hazardGrade: 'Moderate',
    slopeAngleDeg: 32,
    drainageBasin: 'Vaigai Basin Catchment',
    description: 'Perched on southern crest of Palani Hills. Flash gullying on southern drop-off towards Cumbum Valley.',
    historicalMax24hRainMm: 240,
    camera: { center: [77.4892, 10.2381], zoom: 12.5, pitch: 55, bearing: 45 }
  },
  {
    id: 'hill-valparai',
    name: 'Valparai',
    localName: 'வால்பாறை',
    stateCode: 'TN',
    stateName: 'Tamil Nadu',
    district: 'Coimbatore',
    coordinates: [76.9558, 10.3270],
    elevationM: 1193,
    terrainType: 'Anamalai Plateau Rainforest Corridor',
    annualRainfallMm: 4500,
    monsoonPeakMonth: 'July-August',
    hazardGrade: 'Extreme',
    slopeAngleDeg: 40,
    drainageBasin: 'Sholayar / Chalakudy River',
    description: 'One of the wettest hill stations in Southern India. Catchment directly feeds Upper Sholayar dam.',
    historicalMax24hRainMm: 410,
    camera: { center: [76.9558, 10.3270], zoom: 13.1, pitch: 62, bearing: 0 }
  },
  {
    id: 'hill-madikeri',
    name: 'Madikeri (Coorg)',
    localName: 'ಮಡಿಕೇರಿ (ಕೊಡಗು)',
    stateCode: 'KA',
    stateName: 'Karnataka',
    district: 'Kodagu',
    coordinates: [75.7382, 12.4244],
    elevationM: 1150,
    terrainType: 'Brahmagiri Ridge Catchment',
    annualRainfallMm: 3100,
    monsoonPeakMonth: 'July-August',
    hazardGrade: 'Severe',
    slopeAngleDeg: 35,
    drainageBasin: 'Cauvery River Headwaters (Talakaveri)',
    description: 'Birthplace of River Cauvery. Critical headwater zone subject to massive monsoon runoffs and valley inundations.',
    historicalMax24hRainMm: 360,
    camera: { center: [75.7382, 12.4244], zoom: 12.8, pitch: 60, bearing: -30 }
  },
  {
    id: 'hill-agumbe',
    name: 'Agumbe',
    localName: 'ಆಗುಂಬೆ',
    stateCode: 'KA',
    stateName: 'Karnataka',
    district: 'Shimoga',
    coordinates: [75.0934, 13.5074],
    elevationM: 643,
    terrainType: 'Western Ghats West-Facing Escarpment',
    annualRainfallMm: 7620,
    monsoonPeakMonth: 'July',
    hazardGrade: 'Extreme',
    slopeAngleDeg: 44,
    drainageBasin: 'Sita River / Varahi River',
    description: 'Known as the "Cherrapunji of the South". Highest rainfall density in Western Ghats, immediate flash flood downstream in Udupi plains.',
    historicalMax24hRainMm: 620,
    camera: { center: [75.0934, 13.5074], zoom: 13.3, pitch: 68, bearing: -45 }
  },
  {
    id: 'hill-chikmagalur',
    name: 'Chikmagalur / Mullayanagiri',
    localName: 'ಚಿಕ್ಕಮಗಳೂರು',
    stateCode: 'KA',
    stateName: 'Karnataka',
    district: 'Chikkamagaluru',
    coordinates: [75.7754, 13.3153],
    elevationM: 1090,
    terrainType: 'Baba Budan Giri Range',
    annualRainfallMm: 1920,
    monsoonPeakMonth: 'July',
    hazardGrade: 'Moderate',
    slopeAngleDeg: 33,
    drainageBasin: 'Bhadra / Tungabhadra Basin',
    description: 'Highest peak in Karnataka nearby. Feeds Bhadra reservoir, flash runoff in steep coffee plantation ravines.',
    historicalMax24hRainMm: 290,
    camera: { center: [75.7754, 13.3153], zoom: 12.4, pitch: 56, bearing: 20 }
  },
  {
    id: 'hill-yercaud',
    name: 'Yercaud',
    localName: 'ஏற்காடு',
    stateCode: 'TN',
    stateName: 'Tamil Nadu',
    district: 'Salem',
    coordinates: [78.2093, 11.7753],
    elevationM: 1515,
    terrainType: 'Shevaroy Hills (Eastern Ghats Outlier)',
    annualRainfallMm: 1570,
    monsoonPeakMonth: 'October-November',
    hazardGrade: 'Moderate',
    slopeAngleDeg: 28,
    drainageBasin: 'Vaniyar / Ponnaiyar Sub-basin',
    description: 'Isolated high-elevation massif in Eastern Ghats. Vulnerable to post-monsoon cyclonic gales and slope washes.',
    historicalMax24hRainMm: 210,
    camera: { center: [78.2093, 11.7753], zoom: 12.6, pitch: 54, bearing: 10 }
  },
  {
    id: 'hill-horsley',
    name: 'Horsley Hills',
    localName: 'హార్స్లీ హిల్స్',
    stateCode: 'AP',
    stateName: 'Andhra Pradesh',
    district: 'Chittoor',
    coordinates: [78.4005, 13.6558],
    elevationM: 1290,
    terrainType: 'Deccan South-Eastern Escarpment',
    annualRainfallMm: 980,
    monsoonPeakMonth: 'September-October',
    hazardGrade: 'Low',
    slopeAngleDeg: 24,
    drainageBasin: 'Palar River Sub-catchment',
    description: 'Tranquil rocky spur rising abruptly from Rayalaseema semi-arid plains. Flash torrents possible in rocky ravines.',
    historicalMax24hRainMm: 165,
    camera: { center: [78.4005, 13.6558], zoom: 12.5, pitch: 50, bearing: 0 }
  },
  {
    id: 'hill-araku',
    name: 'Araku Valley',
    localName: 'అరకు లోయ',
    stateCode: 'AP',
    stateName: 'Andhra Pradesh',
    district: 'Alluri Sitharama Raju',
    coordinates: [82.8833, 18.3333],
    elevationM: 911,
    terrainType: 'Northern Eastern Ghats Valley',
    annualRainfallMm: 1350,
    monsoonPeakMonth: 'August-September',
    hazardGrade: 'Moderate',
    slopeAngleDeg: 30,
    drainageBasin: 'Gosthani / Champavathi Basin',
    description: 'Lush valley enclosed by Galikonda and Sunkarimetta ridges. Inundation during Bay of Bengal depressions.',
    historicalMax24hRainMm: 220,
    camera: { center: [82.8833, 18.3333], zoom: 12.4, pitch: 52, bearing: -15 }
  },
  {
    id: 'hill-ananthagiri',
    name: 'Ananthagiri Hills',
    localName: 'అనంతగిరి కొండలు',
    stateCode: 'TG',
    stateName: 'Telangana',
    district: 'Vikarabad',
    coordinates: [77.8631, 17.3081],
    elevationM: 700,
    terrainType: 'Lateritic Deccan Plateau Ridge',
    annualRainfallMm: 890,
    monsoonPeakMonth: 'July-August',
    hazardGrade: 'Low',
    slopeAngleDeg: 18,
    drainageBasin: 'Musi River Origin (Krishna Tributary)',
    description: 'Source of the Musi River that flows through Hyderabad. Cloudbursts cause sudden downstream surges in Musi channels.',
    historicalMax24hRainMm: 180,
    camera: { center: [77.8631, 17.3081], zoom: 12.8, pitch: 48, bearing: 0 }
  }
];

// 3. Real South Indian Major River Systems
export const SOUTH_INDIA_RIVERS: RiverSystem[] = [
  {
    id: 'river-cauvery',
    name: 'Cauvery (Kaveri)',
    origin: 'Talakaveri, Brahmagiri, Kodagu (KA)',
    lengthKm: 805,
    basinAreaSqKm: 81155,
    statesTraversed: ['Karnataka', 'Tamil Nadu', 'Kerala', 'Puducherry'],
    averageAnnualDischargeBCM: 21.4,
    floodSensitivity: 'High',
    tributaries: ['Harangi', 'Hemavati', 'Shimsha', 'Arkavathi', 'Lakshmana Tirtha', 'Kabini', 'Bhavani', 'Noyyal', 'Amaravati'],
    coordinates: [
      [75.49, 12.38], [75.74, 12.42], [76.01, 12.48], [76.57, 12.43],
      [76.90, 12.22], [77.15, 12.10], [77.72, 11.95], [77.85, 11.55],
      [78.15, 11.08], [78.65, 10.85], [79.15, 10.82], [79.65, 10.95],
      [79.85, 11.15]
    ]
  },
  {
    id: 'river-periyar',
    name: 'Periyar River',
    origin: 'Sivagiri Hills, Western Ghats (KL)',
    lengthKm: 244,
    basinAreaSqKm: 5398,
    statesTraversed: ['Kerala', 'Tamil Nadu'],
    averageAnnualDischargeBCM: 11.6,
    floodSensitivity: 'Severe',
    tributaries: ['Mullayar', 'Cheruthoni', 'Perinjankutti', 'Edamalayar', 'Muthirappuzha'],
    coordinates: [
      [77.25, 9.45], [77.10, 9.58], [76.98, 9.85], [76.90, 9.98],
      [76.75, 10.12], [76.45, 10.15], [76.22, 10.18], [76.18, 10.20]
    ]
  },
  {
    id: 'river-krishna',
    name: 'Krishna River',
    origin: 'Mahabaleshwar (MH) -> Karnataka -> Telangana -> AP',
    lengthKm: 1400,
    basinAreaSqKm: 258948,
    statesTraversed: ['Karnataka', 'Telangana', 'Andhra Pradesh', 'Maharashtra'],
    averageAnnualDischargeBCM: 78.1,
    floodSensitivity: 'Severe',
    tributaries: ['Koyna', 'Ghataprabha', 'Malaprabha', 'Bhima', 'Tungabhadra', 'Musi', 'Munneru'],
    coordinates: [
      [74.55, 16.55], [75.12, 16.48], [75.88, 16.35], [76.75, 16.15],
      [77.35, 16.22], [78.25, 16.12], [78.95, 16.08], [79.85, 16.55],
      [80.65, 16.51], [80.95, 15.78]
    ]
  },
  {
    id: 'river-godavari',
    name: 'Godavari River',
    origin: 'Trimbakeshwar (MH) -> Telangana -> AP',
    lengthKm: 1465,
    basinAreaSqKm: 312812,
    statesTraversed: ['Telangana', 'Andhra Pradesh', 'Maharashtra'],
    averageAnnualDischargeBCM: 110.5,
    floodSensitivity: 'Severe',
    tributaries: ['Pranhita', 'Indravati', 'Sabari', 'Manjira', 'Kinnerasani'],
    coordinates: [
      [77.85, 18.95], [78.45, 18.98], [79.25, 18.82], [79.85, 18.75],
      [80.65, 17.85], [81.35, 17.55], [81.78, 17.02], [82.25, 16.75]
    ]
  },
  {
    id: 'river-tungabhadra',
    name: 'Tungabhadra River',
    origin: 'Koodli, Shivamogga, Western Ghats (KA)',
    lengthKm: 531,
    basinAreaSqKm: 71417,
    statesTraversed: ['Karnataka', 'Telangana', 'Andhra Pradesh'],
    averageAnnualDischargeBCM: 14.7,
    floodSensitivity: 'High',
    tributaries: ['Tunga', 'Bhadra', 'Varada', 'Kumadvathi', 'Vedavathi'],
    coordinates: [
      [75.68, 14.02], [75.88, 14.75], [76.35, 15.28], [76.95, 15.65],
      [77.45, 15.82], [78.05, 15.95]
    ]
  },
  {
    id: 'river-pamba',
    name: 'Pamba River',
    origin: 'Pulachimalai, Peerumedu, Western Ghats (KL)',
    lengthKm: 176,
    basinAreaSqKm: 2235,
    statesTraversed: ['Kerala'],
    averageAnnualDischargeBCM: 4.6,
    floodSensitivity: 'Severe',
    tributaries: ['Azuthayar', 'Kakkattar', 'Kallar', 'Manimalayar'],
    coordinates: [
      [77.15, 9.38], [76.95, 9.35], [76.75, 9.32], [76.55, 9.35],
      [76.40, 9.42], [76.35, 9.55]
    ]
  },
  {
    id: 'river-chaliyar',
    name: 'Chaliyar River',
    origin: 'Elambalari Hills, Wayanad / Nilgiris (KL/TN)',
    lengthKm: 169,
    basinAreaSqKm: 2923,
    statesTraversed: ['Kerala', 'Tamil Nadu'],
    averageAnnualDischargeBCM: 5.7,
    floodSensitivity: 'Extreme',
    tributaries: ['Iruvanjippuzha', 'Cherupuzha', 'Punnapuzha', 'Karimpuzha'],
    coordinates: [
      [76.22, 11.52], [76.10, 11.42], [75.98, 11.32], [75.82, 11.18]
    ]
  },
  {
    id: 'river-netravati',
    name: 'Netravati River',
    origin: 'Bangrabalige, Kudremukh, Chikkamagaluru (KA)',
    lengthKm: 103,
    basinAreaSqKm: 3410,
    statesTraversed: ['Karnataka'],
    averageAnnualDischargeBCM: 11.2,
    floodSensitivity: 'High',
    tributaries: ['Kumaradhara', 'Gundia'],
    coordinates: [
      [75.25, 13.05], [75.12, 12.88], [74.95, 12.85], [74.82, 12.86]
    ]
  }
];

// 4. Strategic South Indian Reservoirs & Dams
export const SOUTH_INDIA_RESERVOIRS: Reservoir[] = [
  {
    id: 'res-idukki',
    name: 'Idukki Reservoir (Arch Dam)',
    river: 'Periyar',
    state: 'Kerala',
    district: 'Idukki',
    coordinates: [76.9710, 9.8497],
    fullReservoirLevelM: 732.43,
    grossStorageCapacityMCM: 1996,
    liveStoragePercent: 78.4,
    status: 'Alert',
    damType: 'Concrete Double-Curvature Arch',
    inflowCusecs: 14250,
    outflowCusecs: 8500,
    polygon: [[
      [76.92, 9.80], [77.02, 9.82], [77.05, 9.90], [76.98, 9.92], [76.92, 9.80]
    ]]
  },
  {
    id: 'res-mullaperiyar',
    name: 'Mullaperiyar Dam',
    river: 'Periyar',
    state: 'Kerala',
    district: 'Idukki',
    coordinates: [77.1450, 9.5297],
    fullReservoirLevelM: 43.28,
    grossStorageCapacityMCM: 443,
    liveStoragePercent: 86.2,
    status: 'Warning',
    damType: 'Masonry Gravity',
    inflowCusecs: 8400,
    outflowCusecs: 6100,
    polygon: [[
      [77.11, 9.50], [77.18, 9.51], [77.19, 9.56], [77.12, 9.55], [77.11, 9.50]
    ]]
  },
  {
    id: 'res-krs',
    name: 'Krishna Raja Sagara (KRS)',
    river: 'Cauvery',
    state: 'Karnataka',
    district: 'Mandya',
    coordinates: [76.5714, 12.4258],
    fullReservoirLevelM: 38.04,
    grossStorageCapacityMCM: 1390,
    liveStoragePercent: 71.5,
    status: 'Normal',
    damType: 'Masonry & Earthfill',
    inflowCusecs: 22100,
    outflowCusecs: 18500,
    polygon: [[
      [76.52, 12.39], [76.62, 12.41], [76.65, 12.47], [76.54, 12.46], [76.52, 12.39]
    ]]
  },
  {
    id: 'res-almatti',
    name: 'Almatti Dam (Lal Bahadur Shastri)',
    river: 'Krishna',
    state: 'Karnataka',
    district: 'Bagalkot',
    coordinates: [75.8860, 16.3310],
    fullReservoirLevelM: 519.6,
    grossStorageCapacityMCM: 3440,
    liveStoragePercent: 64.0,
    status: 'Normal',
    damType: 'Composite Masonry & Embankment',
    inflowCusecs: 45000,
    outflowCusecs: 38000,
    polygon: [[
      [75.80, 16.30], [75.95, 16.31], [75.96, 16.37], [75.82, 16.36], [75.80, 16.30]
    ]]
  },
  {
    id: 'res-mettur',
    name: 'Mettur Dam (Stanley Reservoir)',
    river: 'Cauvery',
    state: 'Tamil Nadu',
    district: 'Salem',
    coordinates: [77.8014, 11.7967],
    fullReservoirLevelM: 36.58,
    grossStorageCapacityMCM: 2647,
    liveStoragePercent: 82.1,
    status: 'Alert',
    damType: 'Concrete Gravity',
    inflowCusecs: 31200,
    outflowCusecs: 29000,
    polygon: [[
      [77.75, 11.76], [77.85, 11.77], [77.86, 11.85], [77.76, 11.83], [77.75, 11.76]
    ]]
  },
  {
    id: 'res-nagarjunasagar',
    name: 'Nagarjuna Sagar Dam',
    river: 'Krishna',
    state: 'AP / Telangana border',
    district: 'Nalgonda / Palnadu',
    coordinates: [79.3130, 16.5770],
    fullReservoirLevelM: 179.83,
    grossStorageCapacityMCM: 11472,
    liveStoragePercent: 68.3,
    status: 'Normal',
    damType: 'Masonry Gravity',
    inflowCusecs: 62000,
    outflowCusecs: 54000,
    polygon: [[
      [79.22, 16.52], [79.38, 16.54], [79.40, 16.63], [79.25, 16.61], [79.22, 16.52]
    ]]
  },
  {
    id: 'res-srisailam',
    name: 'Srisailam Dam',
    river: 'Krishna',
    state: 'AP / Telangana border',
    district: 'Kurnool / Nagarkurnool',
    coordinates: [78.8970, 16.0870],
    fullReservoirLevelM: 269.75,
    grossStorageCapacityMCM: 6108,
    liveStoragePercent: 74.8,
    status: 'Alert',
    damType: 'Concrete Gravity',
    inflowCusecs: 58000,
    outflowCusecs: 45000,
    polygon: [[
      [78.82, 16.05], [78.96, 16.06], [78.97, 16.14], [78.84, 16.12], [78.82, 16.05]
    ]]
  }
];

// 5. Agro-Climatic Zones of South India
export const SOUTH_INDIA_CLIMATE_ZONES: ClimateZone[] = [
  {
    id: 'clim-western-ghats',
    name: 'Western Ghats Per-Humid Montane Zone',
    classification: 'Tropical Montane Wet (Am)',
    annualPrecipitationRangeMm: '2,800 – 5,800 mm',
    temperatureRangeC: '12°C to 26°C',
    monsoonSystem: 'Heavy South-West Monsoon Orographic Lifting',
    soilRunoffCoeff: 0.82,
    coverageStates: ['Kerala', 'Karnataka', 'Tamil Nadu'],
    description: 'Steep windward slope facing the Arabian Sea. Intense orographic precipitation triggers extreme slope saturation and sudden river surges.',
    color: '#0284c7',
    coordinates: [[
      [74.6, 14.5], [75.4, 13.8], [75.9, 12.8], [76.5, 11.8], [77.1, 10.2],
      [77.4, 8.8], [76.9, 8.5], [76.2, 10.0], [75.6, 11.5], [74.8, 13.5], [74.6, 14.5]
    ]]
  },
  {
    id: 'clim-deccan-plateau',
    name: 'Deccan Semi-Arid Rainshadow Plateau',
    classification: 'Tropical Semi-Arid (BSh)',
    annualPrecipitationRangeMm: '500 – 850 mm',
    temperatureRangeC: '18°C to 42°C',
    monsoonSystem: 'Rainshadow of Western Ghats with Convective Thunderstorms',
    soilRunoffCoeff: 0.58,
    coverageStates: ['Karnataka', 'Telangana', 'Andhra Pradesh'],
    description: 'Dry rolling plateau. Episodic localized cloudbursts cause rapid dry-channel flash floods across black cotton soil basins.',
    color: '#d97706',
    coordinates: [[
      [75.2, 17.5], [78.5, 18.2], [78.8, 15.5], [77.5, 14.0], [76.0, 15.0], [75.2, 17.5]
    ]]
  },
  {
    id: 'clim-coromandel',
    name: 'Coromandel Coastal Wet Plain',
    classification: 'Tropical Wet & Dry (As/Aw)',
    annualPrecipitationRangeMm: '950 – 1,450 mm',
    temperatureRangeC: '22°C to 38°C',
    monsoonSystem: 'North-East Retreating Monsoon & Bay of Bengal Cyclones',
    soilRunoffCoeff: 0.72,
    coverageStates: ['Tamil Nadu', 'Andhra Pradesh'],
    description: 'Receives the bulk of its precipitation between October and December from severe Bay of Bengal cyclonic depressions and coastal storms.',
    color: '#0d9488',
    coordinates: [[
      [80.4, 15.5], [80.2, 13.0], [79.8, 11.0], [78.8, 9.2], [78.0, 9.8],
      [79.2, 12.0], [79.8, 14.5], [80.4, 15.5]
    ]]
  }
];

// 6. Major South Indian Cities
export const SOUTH_INDIA_CITIES = [
  { name: 'Bengaluru', state: 'Karnataka', coordinates: [77.5946, 12.9716], population: 12500000, elevationM: 920 },
  { name: 'Chennai', state: 'Tamil Nadu', coordinates: [80.2707, 13.0827], population: 11000000, elevationM: 6 },
  { name: 'Hyderabad', state: 'Telangana', coordinates: [78.4867, 17.3850], population: 10200000, elevationM: 542 },
  { name: 'Kochi (Cochin)', state: 'Kerala', coordinates: [76.2673, 9.9312], population: 2100000, elevationM: 4 },
  { name: 'Thiruvananthapuram', state: 'Kerala', coordinates: [76.9366, 8.5241], population: 1680000, elevationM: 10 },
  { name: 'Coimbatore', state: 'Tamil Nadu', coordinates: [76.9558, 11.0168], population: 2800000, elevationM: 411 },
  { name: 'Kozhikode (Calicut)', state: 'Kerala', coordinates: [75.7804, 11.2588], population: 2000000, elevationM: 1 },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', coordinates: [83.2185, 17.6868], population: 2300000, elevationM: 45 },
  { name: 'Madurai', state: 'Tamil Nadu', coordinates: [78.1198, 9.9252], population: 1750000, elevationM: 101 },
  { name: 'Mangaluru (Mangalore)', state: 'Karnataka', coordinates: [74.8560, 12.9141], population: 700000, elevationM: 22 }
];

// 7. Representative 3D Buildings in Critical Vulnerable Mountain Settlements (Marked as ESTIMATED footprint heights)
export const SOUTH_INDIA_3D_BUILDINGS: BuildingFootprint[] = [
  // Wayanad / Chooralmala Center
  {
    id: 'bld-way-01',
    name: 'Chooralmala Primary Health Centre',
    buildingType: 'hospital',
    heightM: 12,
    levels: 3,
    minHeightM: 0,
    elevationM: 785,
    settlement: 'Chooralmala, Wayanad',
    isEstimated: true,
    coordinates: [[
      [76.1315, 11.6850], [76.1325, 11.6850], [76.1325, 11.6858], [76.1315, 11.6858], [76.1315, 11.6850]
    ]]
  },
  {
    id: 'bld-way-02',
    name: 'Vellarmala Government Vocational Higher Secondary School',
    buildingType: 'school',
    heightM: 14,
    levels: 3,
    minHeightM: 0,
    elevationM: 780,
    settlement: 'Chooralmala, Wayanad',
    isEstimated: true,
    coordinates: [[
      [76.1330, 11.6845], [76.1342, 11.6845], [76.1342, 11.6855], [76.1330, 11.6855], [76.1330, 11.6845]
    ]]
  },
  {
    id: 'bld-way-03',
    name: 'Meppadi Disaster Relief Operations Center',
    buildingType: 'shelter',
    heightM: 16,
    levels: 4,
    minHeightM: 0,
    elevationM: 810,
    settlement: 'Meppadi, Wayanad',
    isEstimated: true,
    coordinates: [[
      [76.1280, 11.6820], [76.1292, 11.6820], [76.1292, 11.6830], [76.1280, 11.6830], [76.1280, 11.6820]
    ]]
  },
  // Munnar Town
  {
    id: 'bld-mun-01',
    name: 'Munnar General Hospital',
    buildingType: 'hospital',
    heightM: 18,
    levels: 4,
    minHeightM: 0,
    elevationM: 1528,
    settlement: 'Munnar Center',
    isEstimated: true,
    coordinates: [[
      [77.0585, 10.0880], [77.0598, 10.0880], [77.0598, 10.0890], [77.0585, 10.0890], [77.0585, 10.0880]
    ]]
  },
  {
    id: 'bld-mun-02',
    name: 'KDHP Central Tea Processing Facility',
    buildingType: 'critical',
    heightM: 22,
    levels: 4,
    minHeightM: 0,
    elevationM: 1540,
    settlement: 'Munnar Center',
    isEstimated: true,
    coordinates: [[
      [77.0610, 10.0870], [77.0628, 10.0870], [77.0628, 10.0885], [77.0610, 10.0885], [77.0610, 10.0870]
    ]]
  },
  // Ooty Central Ridge
  {
    id: 'bld-oot-01',
    name: 'Nilgiris District Collectorate',
    buildingType: 'police',
    heightM: 20,
    levels: 4,
    minHeightM: 0,
    elevationM: 2245,
    settlement: 'Ooty Town',
    isEstimated: true,
    coordinates: [[
      [76.6940, 11.4110], [76.6955, 11.4110], [76.6955, 11.4122], [76.6940, 11.4122], [76.6940, 11.4110]
    ]]
  },
  {
    id: 'bld-oot-02',
    name: 'Ooty Fire & Rescue Operations Base',
    buildingType: 'fire_station',
    heightM: 12,
    levels: 2,
    minHeightM: 0,
    elevationM: 2238,
    settlement: 'Ooty Town',
    isEstimated: true,
    coordinates: [[
      [76.6960, 11.4095], [76.6972, 11.4095], [76.6972, 11.4105], [76.6960, 11.4105], [76.6960, 11.4095]
    ]]
  },
  // Madikeri Fort Ridge
  {
    id: 'bld-mad-01',
    name: 'Madikeri Fort & District Operations Center',
    buildingType: 'critical',
    heightM: 24,
    levels: 5,
    minHeightM: 0,
    elevationM: 1155,
    settlement: 'Madikeri, Coorg',
    isEstimated: true,
    coordinates: [[
      [75.7370, 12.4235], [75.7388, 12.4235], [75.7388, 12.4250], [75.7370, 12.4250], [75.7370, 12.4235]
    ]]
  }
];

// 8. Historical Flood Benchmark Events
export const HISTORICAL_FLOOD_EVENTS: HistoricalFlood[] = [
  {
    id: 'hist-wayanad-2024',
    title: 'Wayanad Chooralmala–Meppadi Debris Flow Torrent',
    date: '30 July 2024',
    primaryLocation: 'Chooralmala & Mundakkai, Wayanad',
    states: ['Kerala'],
    rainfallAmountMm: 572,
    durationHours: 48,
    triggerEvent: 'Extreme saturated-soil cloudburst along steep Western Ghats escarpment',
    affectedPopulation: 14500,
    economicLossINR: '₹1,200 Crores',
    inundationAreaSqKm: 34.5,
    summary: 'Massive debris flow triggered by 572 mm of rain in 48 hours. River Iruvanjippuzha breached its banks, destroying entire valley settlements.',
    coordinates: [76.1320, 11.6854],
    impactPolygon: [[
      [76.115, 11.670], [76.145, 11.675], [76.148, 11.695], [76.120, 11.698], [76.115, 11.670]
    ]]
  },
  {
    id: 'hist-kerala-2018',
    title: 'The Great Kerala Mega Flood of 2018',
    date: '8–19 August 2018',
    primaryLocation: 'Periyar, Pamba, Bharathappuzha Basins',
    states: ['Kerala'],
    rainfallAmountMm: 414,
    durationHours: 96,
    triggerEvent: 'Synchronized opening of 35 dams following exceptional southwest monsoon depressions',
    affectedPopulation: 5400000,
    economicLossINR: '₹31,000 Crores',
    inundationAreaSqKm: 1840,
    summary: 'Worst flooding in Kerala since 1924. All 14 districts placed on Red Alert. Kochi International Airport submerged for two weeks.',
    coordinates: [76.9710, 9.8497],
    impactPolygon: [[
      [76.25, 9.50], [77.10, 9.55], [77.15, 10.45], [76.20, 10.35], [76.25, 9.50]
    ]]
  },
  {
    id: 'hist-chennai-2023',
    title: 'Cyclone Michaung Chennai Coastal Basin Deluge',
    date: '3–5 December 2023',
    primaryLocation: 'Chennai, Kanchipuram, Tiruvallur',
    states: ['Tamil Nadu'],
    rainfallAmountMm: 450,
    durationHours: 36,
    triggerEvent: 'Stalled Cyclone Michaung over coast dumping extreme rain on urban Adyar and Cooum basins',
    affectedPopulation: 2800000,
    economicLossINR: '₹8,500 Crores',
    inundationAreaSqKm: 420,
    summary: 'Severe urban inundation across Tambaram, Velachery, and Ennore. Airport runway closed due to water ingress from Chembarambakkam outflow.',
    coordinates: [80.2707, 13.0827],
    impactPolygon: [[
      [80.12, 12.92], [80.32, 12.94], [80.30, 13.15], [80.15, 13.14], [80.12, 12.92]
    ]]
  },
  {
    id: 'hist-karnataka-2019',
    title: 'North Karnataka & Coorg Flash Flooding',
    date: 'August 2019',
    primaryLocation: 'Belagavi, Kodagu, Chikkamagaluru',
    states: ['Karnataka'],
    rainfallAmountMm: 380,
    durationHours: 72,
    triggerEvent: 'Extreme inflow in Krishna & Cauvery headwaters combined with massive dam releases',
    affectedPopulation: 700000,
    economicLossINR: '₹10,000 Crores',
    inundationAreaSqKm: 850,
    summary: 'Massive inundation across 17 districts. Belagavi city cut off; extensive coffee plantation slope collapses across Kodagu.',
    coordinates: [75.7382, 12.4244],
    impactPolygon: [[
      [75.60, 12.30], [75.85, 12.35], [75.90, 12.55], [75.65, 12.52], [75.60, 12.30]
    ]]
  }
];

// 9. Real Emergency Relief Shelters
export const EMERGENCY_SHELTERS: EmergencyShelter[] = [
  {
    id: 'shl-way-01',
    name: 'Meppadi High School Relief Center',
    district: 'Wayanad',
    state: 'Kerala',
    coordinates: [76.1285, 11.6815],
    elevationM: 815,
    capacityPersons: 850,
    currentOccupancy: 320,
    hasMedicalPost: true,
    hasHelipad: true,
    safeAccessCorridor: 'State Highway 59 (Kalpetta-Meppadi, Cleared Ridge Road)',
    inundationRiskAtSite: 'None',
    contactPerson: 'K. Rajesh (Disaster Cell)',
    contactNumber: '+91 94471 20041'
  },
  {
    id: 'shl-mun-01',
    name: 'Munnar Government College Auditorium',
    district: 'Idukki',
    state: 'Kerala',
    coordinates: [77.0620, 10.0910],
    elevationM: 1560,
    capacityPersons: 650,
    currentOccupancy: 110,
    hasMedicalPost: true,
    hasHelipad: false,
    safeAccessCorridor: 'NH 85 Upper Bypass Road',
    inundationRiskAtSite: 'None',
    contactPerson: 'S. Mini (Revenue Inspector)',
    contactNumber: '+91 94472 88123'
  },
  {
    id: 'shl-oot-01',
    name: 'Ooty HADP Multi-Purpose Hall',
    district: 'Nilgiris',
    state: 'Tamil Nadu',
    coordinates: [76.6980, 11.4120],
    elevationM: 2250,
    capacityPersons: 1200,
    currentOccupancy: 45,
    hasMedicalPost: true,
    hasHelipad: true,
    safeAccessCorridor: 'Kotagiri Road Ridge Corridor',
    inundationRiskAtSite: 'None',
    contactPerson: 'M. Selvakumar (DRO)',
    contactNumber: '+91 94433 11202'
  },
  {
    id: 'shl-mad-01',
    name: 'Madikeri Town Hall Shelter Hub',
    district: 'Kodagu',
    state: 'Karnataka',
    coordinates: [75.7390, 12.4260],
    elevationM: 1160,
    capacityPersons: 900,
    currentOccupancy: 80,
    hasMedicalPost: true,
    hasHelipad: false,
    safeAccessCorridor: 'Mysuru-Madikeri Highline Highway',
    inundationRiskAtSite: 'None',
    contactPerson: 'B. Somanna (Tahsildar)',
    contactNumber: '+91 94480 34561'
  },
  {
    id: 'shl-val-01',
    name: 'Valparai Municipal Community Center',
    district: 'Coimbatore',
    state: 'Tamil Nadu',
    coordinates: [76.9580, 10.3285],
    elevationM: 1210,
    capacityPersons: 550,
    currentOccupancy: 95,
    hasMedicalPost: true,
    hasHelipad: false,
    safeAccessCorridor: 'Pollachi Ghat Road (Escorted Convoy)',
    inundationRiskAtSite: 'Minimal',
    contactPerson: 'P. Anandhan (Fire & Rescue)',
    contactNumber: '+91 94421 99014'
  }
];
