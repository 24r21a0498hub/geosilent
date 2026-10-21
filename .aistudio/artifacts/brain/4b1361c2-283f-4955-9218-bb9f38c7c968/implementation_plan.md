# Google Maps Grounding & AI Quiet Zone Discovery

Integrate Google Maps Grounding powered by **Gemini 3.8 Flash** (`googleMaps` tool) into Smart Silent Zone. This enables users to search real-world places, discover quiet study spots and workspaces nearby, verify live opening hours, evaluate noise and quietness profiles, and turn verified Google Maps locations directly into automated silent geofences with one tap.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product requirements and UX directions were confirmed during Phase 1 clarification:

- **Integration Scope**: Both real-time **Place Search** (finding specific venues like libraries, hospitals, lecture halls, cinemas) and **Automated Quiet Zone Suggestions** (discovering top-rated quiet locations near current GPS coordinates).
- **Extracted Google Maps Data**: Real-time operating hours (open/closed status), AI quietness assessment rating (e.g. "Silent Study / Focus", "Low Noise / Polite"), and verified street address + coordinates.
- **Access Points ("All" Confirmed)**:
  1. *Add Zone Modal & Map View*: Search input with live Maps Grounding autocomplete and location snapping.
  2. *Dedicated AI Discovery Tab*: Dedicated view in bottom navigation to browse nearby quiet zones with one-tap "Add to Silent Zones".
  3. *Main Dashboard Quick Action*: Instant discovery launcher button on the home screen for rapid venue recommendations.

---

## 1. Overview & Core Concept

### What It Does
Smart Silent Zone uses GPS geofences to automatically silence phone ringers when entering user-defined perimeters. With Google Maps Grounding, users no longer need to manually guess coordinates or draw circles in a vacuum. Instead:
- Users can search any venue name, landmark, or campus building (e.g. "Main University Library", "Kaiser Hospital", "AMC Cinema").
- The server queries Gemini 3.8 Flash grounded with Google Maps data to retrieve exact coordinates, formatted address, current operating hours, and a quietness index.
- Users can view a curated list of quiet spots nearby (libraries, study lounges, religious places, co-working spaces) recommended by Google Maps and save them as active geofences in 1 tap.

### Target Audience & Value
- Students, healthcare workers, cinema-goers, and professionals who frequently visit spaces requiring silent ringer discipline.
- Eliminates manual lat/long configuration and provides verified, real-world venue data with accurate boundary suggestions.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Instant Search & Snapping (Add Zone & Map)**:
   - When creating or editing a zone, the user types a query (e.g., "City Public Library").
   - The app dispatches a request to `/api/maps/search` powered by Gemini 3.8 Flash with the `googleMaps` tool.
   - The user selects a result; the map instantly animates and centers on the verified coordinates with pre-filled venue name, address, recommended radius, and quietness profile.

2. **Automated Nearby Quiet Zone Discovery (Dedicated Tab & Home Quick Action)**:
   - User taps the **"AI Discovery"** tab or the floating **"Find Nearby Quiet Spots"** button on the Home dashboard.
   - Based on user's current GPS position (or simulated location), the app requests quiet venue suggestions within 1–5 km.
   - Places are displayed in structured cards showing name, category, verified address, real-time open/closed status, and quietness rating.
   - Tapping **"Add Geofence"** immediately converts the venue into a monitored Smart Silent Zone.

3. **Zone Card Google Maps Metadata**:
   - Saved zones matched with Google Maps display verified business details, operating hours, and a direct Google Maps link.

### Visual Identity & Theme
- **Theme**: Premium Slate / Dark Indigo theme with crisp contrast, retaining daylight legibility outdoors.
- **Zero-Pill Discipline**: Metadata (hours, quietness rating, distance, category) is displayed as clean unboxed text with subtle typographic separators (`·`), avoiding cluttered candy capsules.
- **Touch Target Ergonomics**: All interactive cards, action buttons, and search inputs maintain a minimum $\ge 44 \times 44\text{px}$ touch hitbox following mobile touch-first standards.
- **Motion & Feedback**: Smooth micro-interactions for search suggestions loading (shimmer skeleton), map pan-and-zoom transitions, and confirmation toasts when adding discovered zones.

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Why | Alternatives Considered |
| :--- | :--- | :--- | :--- |
| **Model & Tooling** | `gemini-3.8-flash` with `{ googleMaps: {} }` tool | Mandatory requirement; delivers real-time Google Maps grounding for live venue details and hours | Legacy Places API (requires separate GCP credentials and billing setup) |
| **Server Architecture** | Full-stack `server.ts` running Express + Vite middleware proxy (`/api/maps/*`) | Protects Gemini API calls server-side in compliance with platform guidelines; zero client API key exposure | Direct client SDK calls (prohibited by system instructions) |
| **Data Synchronization** | Cache discovered venue metadata in local state & exportable JSON | Allows offline zone monitoring even if disconnected from internet after saving | Requiring continuous live Maps API lookups on every geofence trigger |
| **Quietness Classification** | AI-derived quietness category (e.g. *Strictly Silent*, *Whisper Only*, *Vibrate Recommended*) | Helps user pick appropriate ringer mode (`silent`, `vibrate`, or `priority`) automatically | Flat binary silent mode with no contextual intelligence |

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (React 19 SPA)                         │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ UI Surfaces:                                                   │   │
│   │  • Home Quick Launcher ("Find Quiet Places")                   │   │
│   │  • Dedicated "AI Discovery" Tab                                │   │
│   │  • Add/Edit Zone Modal with Google Maps Search Bar             │   │
│   │  • Interactive Visual Map View (Snapped Pins)                  │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ HTTP POST JSON                     │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ State Store (Local Storage + Zone Engine):                     │   │
│   │  • Saved Zones + Google Maps Grounding Metadata                │   │
│   │  • Geofence Monitor & Auto-DND Trigger                         │   │
│   └────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ /api/maps/search & /api/maps/nearby
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     SERVER (Express + Vite Proxy)                      │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Endpoints:                                                     │   │
│   │  • POST /api/maps/search (Query + Location Bias)               │   │
│   │  • POST /api/maps/nearby-quiet (GPS Coordinates + Radius)      │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ @google/genai SDK                  │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Gemini 3.8 Flash (`gemini-3.8-flash`)                          │   │
│   │ Tools: [{ googleMaps: {} }]                                    │   │
│   │ Extraction: Coordinates, Opening Hours, Quietness, Address    │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Schema Extensions (`src/types.ts`)

```ts
export interface MapsGroundingMetadata {
  placeId?: string;
  formattedAddress: string;
  operatingHours?: string;
  isOpenNow?: boolean;
  quietnessRating?: 'silent' | 'whisper' | 'normal';
  quietnessSummary?: string;
  googleMapsUrl?: string;
  placeCategory?: string;
}

// Extended Zone interface
export interface Zone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  silenceMode: SilenceMode;
  wifiSsid?: string;
  mapsMetadata?: MapsGroundingMetadata; // NEW: Grounded venue data
  createdAt: number;
  lastEnteredAt?: number;
  totalVisits?: number;
}
```

### Key Sequences & Server Endpoints

1. **`server.ts` Implementation**:
   - Mounts Express with `tsx server.ts`.
   - Initializes `GoogleGenAI` using `process.env.GEMINI_API_KEY`.
   - `/api/maps/search`: Accepts `{ query: string, lat?: number, lng?: number }`. Invokes `gemini-3.8-flash` with `{ googleMaps: {} }` to search and structure venue matches.
   - `/api/maps/nearby-quiet`: Accepts `{ lat: number, lng: number }`. Prompts `gemini-3.8-flash` with `googleMaps` to return the top 5 quietest spots nearby (libraries, study areas, hospitals, religious venues, quiet parks).

2. **Client Components**:
   - `src/components/PlaceSearchInput.tsx`: Search input with debounce, loader, and grounded results list.
   - `src/components/QuietPlaceDiscoveryModal.tsx`: Dedicated discovery modal/tab displaying nearby grounded quiet zones with distance and 1-tap add.
   - Updates to `ZonesVisualMap.tsx` and `App.tsx` navigation.
