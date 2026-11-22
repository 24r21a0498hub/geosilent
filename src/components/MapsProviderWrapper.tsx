import React, { createContext, useContext, useEffect, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';

interface MapsEnvironmentContextValue {
  hasMapsKey: boolean;
  mapsQuotaExceeded: boolean;
}

const MapsEnvironmentContext = createContext<MapsEnvironmentContextValue>({
  hasMapsKey: false,
  mapsQuotaExceeded: false,
});

export function useMapsEnvironment() {
  return useContext(MapsEnvironmentContext);
}

const MAPS_LIBRARIES = ['marker', 'geometry'];

export function MapsProviderWrapper({ children }: { children: React.ReactNode }) {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const envKey = metaEnv?.VITE_GOOGLE_MAPS_API_KEY || '';
  const [apiKey, setApiKey] = useState<string>(envKey);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  useEffect(() => {
    if (envKey) {
      setApiKey(envKey);
      return;
    }

    let cancelled = false;
    fetch('/api/maps/js-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.apiKey === 'string' && data.apiKey) {
          setApiKey(data.apiKey);
        }
      })
      .catch(() => {
        // Fallback silently to radar view if config endpoint unreachable
      });

    return () => {
      cancelled = true;
    };
  }, [envKey]);

  const hasMapsKey = Boolean(apiKey && !mapsQuotaExceeded);

  if (!apiKey) {
    return (
      <MapsEnvironmentContext.Provider value={{ hasMapsKey: false, mapsQuotaExceeded }}>
        {children}
      </MapsEnvironmentContext.Provider>
    );
  }

  return (
    <MapsEnvironmentContext.Provider value={{ hasMapsKey, mapsQuotaExceeded }}>
      <APIProvider
        apiKey={apiKey}
        libraries={MAPS_LIBRARIES}
        version="weekly"
        onError={() => {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }}
      >
        {children}
      </APIProvider>
    </MapsEnvironmentContext.Provider>
  );
}
