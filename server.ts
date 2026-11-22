import express from 'express';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize Google GenAI with GEMINI_API_KEY from environment
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY environment variable is not set. Using fallback mode.');
    return null;
  }
  return new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Helper to extract JSON from model text
function extractJsonFromText(text: string): any {
  try {
    const cleaned = text.trim();
    // Try pure JSON first
    if ((cleaned.startsWith('{') && cleaned.endsWith('}')) || (cleaned.startsWith('[') && cleaned.endsWith(']'))) {
      return JSON.parse(cleaned);
    }
    // Try markdown code block ```json ... ```
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      return JSON.parse(match[1].trim());
    }
    // Search for first { or [ to matching end
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIdx = -1;
    let endIdx = -1;

    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      startIdx = firstBracket;
      endIdx = cleaned.lastIndexOf(']');
    } else if (firstBrace !== -1) {
      startIdx = firstBrace;
      endIdx = cleaned.lastIndexOf('}');
    }

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      return JSON.parse(cleaned.substring(startIdx, endIdx + 1));
    }
  } catch (err) {
    console.error('Failed to parse JSON from model output:', err);
  }
  return null;
}

// Helper to extract Grounding chunks URLs
function extractGroundingLinks(response: any): Array<{ title?: string; uri?: string }> {
  try {
    const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (Array.isArray(chunks)) {
      return chunks
        .map((c: any) => ({
          title: c?.maps?.title || c?.web?.title,
          uri: c?.maps?.uri || c?.web?.uri,
        }))
        .filter((l) => !!l.uri);
    }
  } catch (e) {
    // ignore
  }
  return [];
}

// In-memory caching and rate-limiting backoff management
interface CacheEntry {
  timestamp: number;
  data: any;
  lat: number;
  lng: number;
}
const nearbyCache: CacheEntry[] = [];
const searchCache = new Map<string, { timestamp: number; data: any }>();
let geminiRateLimitBackoffUntil = 0;

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function generateDynamicFallbackPlaces(centerLat: number, centerLng: number) {
  return [
    {
      name: 'City Public Library - Main Branch',
      lat: Number((centerLat + 0.0018).toFixed(6)),
      lng: Number((centerLng + 0.0014).toFixed(6)),
      formattedAddress: '100 Library Way, Downtown',
      operatingHours: 'Open · Closes 8:00 PM',
      isOpenNow: true,
      quietnessRating: 'silent',
      quietnessSummary: 'Quiet reading rooms & strict silence on 3rd floor',
      recommendedRadius: 120,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Public Library')}`,
      placeCategory: 'Public Library',
    },
    {
      name: 'University Health Clinic & Wards',
      lat: Number((centerLat - 0.0022).toFixed(6)),
      lng: Number((centerLng + 0.0019).toFixed(6)),
      formattedAddress: '450 Medical Blvd, Suite 100',
      operatingHours: 'Open 24 Hours',
      isOpenNow: true,
      quietnessRating: 'silent',
      quietnessSummary: 'Hospital patient recovery wards & consultation offices',
      recommendedRadius: 150,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Health Center Hospital')}`,
      placeCategory: 'Hospital & Healthcare',
    },
    {
      name: 'Campus Silent Study Hall',
      lat: Number((centerLat + 0.0012).toFixed(6)),
      lng: Number((centerLng - 0.0021).toFixed(6)),
      formattedAddress: 'Academic Quad Building 4',
      operatingHours: 'Open · Closes 11:00 PM',
      isOpenNow: true,
      quietnessRating: 'silent',
      quietnessSummary: 'Zero-talking policy for exams & deep focus',
      recommendedRadius: 90,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Study Hall University')}`,
      placeCategory: 'University Hall',
    },
    {
      name: 'Grand Cinema & IMAX Theaters',
      lat: Number((centerLat - 0.0016).toFixed(6)),
      lng: Number((centerLng - 0.0014).toFixed(6)),
      formattedAddress: '780 Theater Row',
      operatingHours: 'Open · Closes 12:00 AM',
      isOpenNow: true,
      quietnessRating: 'silent',
      quietnessSummary: 'Screening auditoriums strictly require silent phones',
      recommendedRadius: 110,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Cinema Theater')}`,
      placeCategory: 'Movie Theater',
    },
  ];
}

/**
 * POST /api/maps/search
 * Uses gemini-3.8-flash with Google Maps tool to ground venue searches
 */
app.post('/api/maps/search', async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  const centerLat = typeof req.body?.lat === 'number' ? req.body.lat : 37.7749;
  const centerLng = typeof req.body?.lng === 'number' ? req.body.lng : -122.4194;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  // Check in-memory search cache
  const cacheKey = `${query.toLowerCase()}_${centerLat.toFixed(2)}_${centerLng.toFixed(2)}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return res.json({ ...cached.data, source: 'cache' });
  }

  // Check rate limit backoff
  if (Date.now() < geminiRateLimitBackoffUntil) {
    const fallback = {
      places: [
        {
          name: query,
          lat: Number((centerLat + 0.0015).toFixed(6)),
          lng: Number((centerLng + 0.0012).toFixed(6)),
          formattedAddress: `${query}, City Center`,
          operatingHours: 'Open · Closes 8:00 PM',
          isOpenNow: true,
          quietnessRating: 'silent',
          quietnessSummary: 'Designated focus and quiet study space',
          recommendedRadius: 100,
          googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
          placeCategory: 'Study & Work',
        },
      ],
      source: 'resilient_fallback',
    };
    return res.json(fallback);
  }

  try {
    const ai = getGenAI();
    if (!ai) {
      const fallback = {
        places: [
          {
            name: query,
            lat: Number((centerLat + 0.0015).toFixed(6)),
            lng: Number((centerLng + 0.0012).toFixed(6)),
            formattedAddress: `${query}, City Center`,
            operatingHours: 'Open · Closes 9:00 PM',
            isOpenNow: true,
            quietnessRating: 'silent',
            quietnessSummary: 'Designated quiet study area, silent phones recommended',
            recommendedRadius: 100,
            googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
            placeCategory: 'Library / Study Facility',
          },
        ],
        source: 'resilient_fallback',
      };
      return res.json(fallback);
    }

    const prompt = `Use Google Maps grounding data to search for: "${query}". Near latitude ${centerLat}, longitude ${centerLng}.
Find 1 to 3 real matching places. For each place, return the exact verified coordinates, formatted street address, current real-time operating hours status, a quietness level assessment for phone silencing ('silent', 'whisper', or 'normal'), and a recommended geofence radius in meters.

Return ONLY a JSON array with this exact structure:
[
  {
    "name": "Name of Place",
    "lat": 37.7749,
    "lng": -122.4194,
    "formattedAddress": "Full Street Address, City, State",
    "operatingHours": "Open · Closes 8:00 PM",
    "isOpenNow": true,
    "quietnessRating": "silent",
    "quietnessSummary": "Detailed reason why this spot needs quiet phones",
    "recommendedRadius": 100,
    "googleMapsUrl": "https://maps.google.com/...",
    "placeCategory": "Library / Hospital / Cinema / University"
  }
]`;

    const config: any = {
      tools: [{ googleMaps: {} }],
      temperature: 0.2,
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: centerLat,
            longitude: centerLng,
          },
        },
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config,
    });

    const groundingLinks = extractGroundingLinks(response);
    let parsed = extractJsonFromText(response.text || '');

    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      parsed = parsed.map((p: any, i: number) => {
        if (!p.googleMapsUrl || p.googleMapsUrl.includes('...')) {
          p.googleMapsUrl = groundingLinks[i]?.uri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name || query)}`;
        }
        return p;
      });
      const resultData = { places: parsed, source: 'google_maps_grounding', groundingLinks };
      searchCache.set(cacheKey, { timestamp: Date.now(), data: resultData });
      return res.json(resultData);
    }

    if (parsed && typeof parsed === 'object' && parsed.name) {
      if (!parsed.googleMapsUrl || parsed.googleMapsUrl.includes('...')) {
        parsed.googleMapsUrl = groundingLinks[0]?.uri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parsed.name)}`;
      }
      const resultData = { places: [parsed], source: 'google_maps_grounding', groundingLinks };
      searchCache.set(cacheKey, { timestamp: Date.now(), data: resultData });
      return res.json(resultData);
    }

    const fallbackData = {
      places: [
        {
          name: query,
          lat: centerLat,
          lng: centerLng,
          formattedAddress: response.text ? response.text.slice(0, 100) : `${query}, Verified Location`,
          operatingHours: 'Open',
          isOpenNow: true,
          quietnessRating: 'silent',
          quietnessSummary: 'Quiet zone recommended for phone silencing',
          recommendedRadius: 100,
          googleMapsUrl: groundingLinks[0]?.uri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
          placeCategory: 'Study & Work',
        },
      ],
      source: 'partial',
      groundingLinks,
    };
    return res.json(fallbackData);
  } catch (error: any) {
    const isRateLimit = error?.status === 429 || `${error?.message || ''}`.includes('429') || `${error?.message || ''}`.includes('RESOURCE_EXHAUSTED');
    if (isRateLimit) {
      geminiRateLimitBackoffUntil = Date.now() + 120000;
    }
    return res.json({
      places: [
        {
          name: query,
          lat: Number((centerLat + 0.0015).toFixed(6)),
          lng: Number((centerLng + 0.0012).toFixed(6)),
          formattedAddress: `${query}, City Center`,
          operatingHours: 'Open · Closes 8:00 PM',
          isOpenNow: true,
          quietnessRating: 'silent',
          quietnessSummary: 'Designated focus and quiet study space',
          recommendedRadius: 100,
          googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
          placeCategory: 'Study & Work',
        },
      ],
      source: 'resilient_fallback',
    });
  }
});

/**
 * POST /api/maps/nearby-quiet
 * Discovers real-world quiet venues (libraries, hospitals, study halls, cinemas)
 * near user's GPS position using Gemini 3.8 Flash grounded with Google Maps.
 */
app.post('/api/maps/nearby-quiet', async (req, res) => {
  const centerLat = typeof req.body?.lat === 'number' ? req.body.lat : 37.7749;
  const centerLng = typeof req.body?.lng === 'number' ? req.body.lng : -122.4194;

  // Check in-memory cache for nearby locations (< 400m away, cached < 10 mins)
  const cached = nearbyCache.find((entry) => {
    if (Date.now() - entry.timestamp > 10 * 60 * 1000) return false;
    const dist = calculateDistanceMeters(centerLat, centerLng, entry.lat, entry.lng);
    return dist < 400;
  });
  if (cached) {
    return res.json({ ...cached.data, source: 'cache' });
  }

  // If in rate-limit backoff window, deliver dynamic location-adapted fallback directly
  if (Date.now() < geminiRateLimitBackoffUntil) {
    const places = generateDynamicFallbackPlaces(centerLat, centerLng);
    return res.json({ places, source: 'resilient_fallback' });
  }

  try {
    const ai = getGenAI();
    if (!ai) {
      const mockNearby = generateDynamicFallbackPlaces(centerLat, centerLng);
      return res.json({ places: mockNearby, source: 'resilient_fallback' });
    }

    const prompt = `Use Google Maps data to find 4 to 6 real-world quiet places near latitude ${centerLat}, longitude ${centerLng}.
Focus on venues where phone ringers should strictly be muted or set to Do Not Disturb:
- Public libraries, university reading rooms, academic study halls
- Hospitals, clinical recovery centers, patient wards
- Movie theaters / cinemas, performing arts halls
- Quiet co-working focus spaces, places of worship

For each place, retrieve its accurate real-world coordinates, verified street address, real-time operating hours, quietness rating ('silent', 'whisper', or 'normal'), and recommended geofence radius.

Return ONLY a valid JSON array matching this exact format:
[
  {
    "name": "Exact Venue Name",
    "lat": 37.775,
    "lng": -122.419,
    "formattedAddress": "Full Street Address, City, State",
    "operatingHours": "Open · Closes 9:00 PM",
    "isOpenNow": true,
    "quietnessRating": "silent",
    "quietnessSummary": "Summary of quiet rules / focus environment",
    "recommendedRadius": 100,
    "googleMapsUrl": "https://maps.google.com/...",
    "placeCategory": "Library / Hospital / Cinema / Study"
  }
]`;

    const config: any = {
      tools: [{ googleMaps: {} }],
      temperature: 0.2,
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: centerLat,
            longitude: centerLng,
          },
        },
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config,
    });

    const groundingLinks = extractGroundingLinks(response);
    let parsed = extractJsonFromText(response.text || '');

    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      parsed = parsed.map((p: any, i: number) => {
        if (!p.googleMapsUrl || p.googleMapsUrl.includes('...')) {
          p.googleMapsUrl = groundingLinks[i]?.uri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name || 'quiet place')}`;
        }
        return p;
      });
      const responseData = { places: parsed, source: 'google_maps_grounding', groundingLinks };
      nearbyCache.push({ timestamp: Date.now(), data: responseData, lat: centerLat, lng: centerLng });
      return res.json(responseData);
    }

    // If parsing was empty or not an array, return dynamic fallback
    const fallbackPlaces = generateDynamicFallbackPlaces(centerLat, centerLng);
    return res.json({ places: fallbackPlaces, source: 'resilient_fallback' });
  } catch (error: any) {
    const isRateLimit = error?.status === 429 || `${error?.message || ''}`.includes('429') || `${error?.message || ''}`.includes('RESOURCE_EXHAUSTED');
    if (isRateLimit) {
      geminiRateLimitBackoffUntil = Date.now() + 180000;
    }
    const fallbackPlaces = generateDynamicFallbackPlaces(centerLat, centerLng);
    return res.json({ places: fallbackPlaces, source: 'resilient_fallback' });
  }
});

// Runtime Maps JS API key lookup fallback (client-restricted browser key)
app.get('/api/maps/js-config', (_req, res) => {
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
  res.json({ apiKey });
});

// Pure Node CRC32 + ZIP generator for exporting the standalone /android APK project
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function computeCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function collectDirectoryFiles(dirPath: string, prefix = ''): Array<{ name: string; data: Buffer }> {
  const results: Array<{ name: string; data: Buffer }> = [];
  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.gradle' || entry.name === 'build' || entry.name === '.idea') continue;
    const fullPath = path.join(dirPath, entry.name);
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...collectDirectoryFiles(fullPath, relPath));
    } else if (entry.isFile()) {
      results.push({ name: relPath, data: fs.readFileSync(fullPath) });
    }
  }
  return results;
}

function buildZipBuffer(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileNameBuf = Buffer.from(entry.name, 'utf8');
    const compressed = zlib.deflateRawSync(entry.data);
    const crc = computeCrc32(entry.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x5421, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(fileNameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, fileNameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x5421, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(fileNameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, fileNameBuf);
    offset += localHeader.length + fileNameBuf.length + compressed.length;
  }

  const centralDirBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirBuf, eocd]);
}

// Downloadable Android Studio / Gradle APK Source Archive (includes inbuilt DND bridge + CI workflow)
app.get('/api/android/project.zip', (_req, res) => {
  try {
    const androidDir = path.resolve(__dirname, 'android');
    const files = collectDirectoryFiles(androidDir, 'SmartSilentZone-Android');
    if (files.length === 0) {
      return res.status(404).json({ error: 'Android project directory not found' });
    }
    const zipBuffer = buildZipBuffer(files);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="SmartSilentZone-Android-APK-Project.zip"');
    res.setHeader('Content-Length', String(zipBuffer.length));
    return res.send(zipBuffer);
  } catch (err) {
    console.error('Failed to bundle Android project ZIP:', err);
    return res.status(500).json({ error: 'Failed to export Android project archive' });
  }
});

// Mount Vite middleware in development or serve static in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Silent Zone server running on port ${PORT}`);
  });
}

startServer();
