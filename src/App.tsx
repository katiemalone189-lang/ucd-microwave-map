import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Condition = "Very good" | "Good" | "Fair" | "Needs attention" | "—";

type Location = {
  id: number;
  name: string;
  detail: string;
  total: number;
  working: number;
  condition: Condition;
  x: number;
  y: number;
  lat?: number;
  lng?: number;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const conditions: Condition[] = ["Very good", "Good", "Fair", "Needs attention", "—"];

const isLocation = (value: unknown): value is Location => {
  if (!value || typeof value !== "object") return false;
  const location = value as Partial<Location>;
  return (
    typeof location.id === "number" &&
    typeof location.name === "string" &&
    typeof location.detail === "string" &&
    typeof location.total === "number" &&
    typeof location.working === "number" &&
    typeof location.x === "number" &&
    typeof location.y === "number" &&
    conditions.includes(location.condition as Condition)
  );
};

const initialLocations: Location[] = [
  { id: 1, name: "Quinn", detail: "UCD Quinn School", total: 2, working: 2, condition: "Very good", x: 70.9, y: 67.9, lat: 53.3044601, lng: -6.2204415 },
  { id: 2, name: "Village", detail: "Village Centre", total: 3, working: 1, condition: "Very good", x: 75.2, y: 90, lat: 53.3007, lng: -6.2192 },
  { id: 3, name: "Sutherland", detail: "Sutherland School of Law", total: 2, working: 2, condition: "Very good", x: 76.4, y: 68.1, lat: 53.3044316, lng: -6.2188344 },
  { id: 4, name: "Engineering", detail: "Engineering & Materials", total: 3, working: 3, condition: "Good", x: 25.7, y: 39.9, lat: 53.3092152, lng: -6.2335577 },
  { id: 5, name: "Vet", detail: "Veterinary Sciences", total: 6, working: 5, condition: "Very good", x: 63.2, y: 36.6, lat: 53.309781, lng: -6.2226802 },
  { id: 6, name: "Health Science", detail: "Health Sciences Centre", total: 2, working: 2, condition: "Fair", x: 51.3, y: 38.3, lat: 53.3094971, lng: -6.2261101 },
  { id: 7, name: "Sport Centre SU", detail: "Student Union area", total: 2, working: 2, condition: "Very good", x: 45.1, y: 45, lat: 53.3083575, lng: -6.2279133 },
  { id: 8, name: "James Joyce SU", detail: "Student Centre", total: 6, working: 6, condition: "Good", x: 61.6, y: 55.3, lat: 53.3065973, lng: -6.2231451 },
  { id: 9, name: "Ag Science", detail: "Agriculture & Food Science", total: 4, working: 4, condition: "Very good", x: 57.4, y: 52.2, lat: 53.3071326, lng: -6.2243433 },
  { id: 10, name: "O'Connor", detail: "O'Connor Building", total: 3, working: 3, condition: "Very good", x: 71.7, y: 41.2, lat: 53.309, lng: -6.2202 },
  { id: 11, name: "Computer Science", detail: "School of Computer Science", total: 0, working: 0, condition: "—", x: 58.8, y: 39.4, lat: 53.3093013, lng: -6.2239585 },
  { id: 12, name: "Confucius Institute", detail: "Confucius Institute", total: 0, working: 0, condition: "—", x: 70.3, y: 87.5, lat: 53.3011183, lng: -6.2206154 },
  { id: 13, name: "Gather & Gather", detail: "Main UCD Restaurant", total: 0, working: 0, condition: "—", x: 70, y: 62.4, lat: 53.305393, lng: -6.2207002 },
  { id: 14, name: "O'Brien Centre for Science", detail: "UCD Science Centre", total: 4, working: 4, condition: "Good", x: 57.6, y: 48.6, lat: 53.3077327, lng: -6.2242939 },
];

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
if (googleMapsApiKey) setOptions({ key: googleMapsApiKey, v: "weekly" });

const googleMapCenter = { lat: 53.3077, lng: -6.2227 };
const googleMapZoom = 15;

const mapPosition = (location: Location) => ({
  lat: location.lat ?? 53.316 - location.y * 0.00017,
  lng: location.lng ?? -6.241 + location.x * 0.00029,
});

const worldPoint = (lat: number, lng: number) => {
  const worldSize = 256 * 2 ** googleMapZoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize,
  };
};

const fallbackMapOffset = (location: Location) => {
  const center = worldPoint(googleMapCenter.lat, googleMapCenter.lng);
  const position = mapPosition(location);
  const point = worldPoint(position.lat, position.lng);
  return { x: point.x - center.x, y: point.y - center.y };
};

const geoFromMapOffset = (x: number, y: number) => {
  const worldSize = 256 * 2 ** googleMapZoom;
  const center = worldPoint(googleMapCenter.lat, googleMapCenter.lng);
  const worldX = center.x + x;
  const worldY = center.y + y;
  const lng = (worldX / worldSize) * 360 - 180;
  const mercatorY = Math.PI * (1 - (2 * worldY) / worldSize);
  const lat = (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI;
  return { lat, lng };
};

const interfacePositionFromGeo = (lat: number, lng: number) => ({
  x: Math.max(0, Math.min(100, (lng + 6.241) / 0.00029)),
  y: Math.max(0, Math.min(100, (53.316 - lat) / 0.00017)),
});

const interfacePosition = (position: google.maps.LatLng) => ({
  ...interfacePositionFromGeo(position.lat(), position.lng()),
});

const Icon = ({ name, size = 18 }: { name: string; size?: number }) => {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 };
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  if (name === "edit") return <svg {...common}><path d="m4 16-.8 4 4-.8L18.5 7.9l-3.2-3.2L4 16Z" /><path d="m13.8 6.2 3.2 3.2" /></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "minus") return <svg {...common}><path d="M5 12h14" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === "locate") return <svg {...common}><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" /><path d="M12 2V5M12 19v3M2 12h3M19 12h3" /></svg>;
  if (name === "layers") return <svg {...common}><path d="m12 3-9 5 9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></svg>;
  if (name === "arrow") return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
  if (name === "microwave") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h8v6H7zM18 9h.01M18 13h.01" /></svg>;
  if (name === "download") return <svg {...common}><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>;
  if (name === "upload") return <svg {...common}><path d="M12 16V4m0 0 4 4m-4-4L8 8M5 21h14" /></svg>;
  if (name === "install") return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M12 7v7m0 0 3-3m-3 3-3-3M9 18h6" /></svg>;
  return null;
};

function CampusMap({
  locations,
  selected,
  onSelect,
  onMove,
  zoom,
}: {
  locations: Location[];
  selected: number | null;
  onSelect: (id: number) => void;
  onMove: (id: number, x: number, y: number, lat: number, lng: number) => void;
  zoom: number;
}) {
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const draggedPin = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (!googleMapsApiKey || !mapNode.current || map.current) return;

    let active = true;
    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([mapsLibrary]) => {
        if (!active || !mapNode.current) return;
        map.current = new mapsLibrary.Map(mapNode.current, {
          center: googleMapCenter,
          zoom: googleMapZoom,
          mapTypeId: "roadmap",
          mapTypeControl: false,
          streetViewControl: false,
          clickableIcons: true,
          fullscreenControl: true,
        });
        setMapReady(true);
      })
      .catch(() => setMapError(true));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !mapReady) return;
    markers.current.forEach((marker) => marker.setMap(null));
    markers.current = locations.map((location) => {
      const hasIssue = location.total > location.working;
      const unavailable = location.total === 0;
      const isSelected = selected === location.id;
      const marker = new google.maps.Marker({
        map: map.current,
        position: mapPosition(location),
        title: location.name,
        icon: {
          path: "M 0,-20 C -11,-20 -18,-12 -18,-2 C -18,10 0,26 0,26 C 0,26 18,10 18,-2 C 18,-12 11,-20 0,-20 Z",
          fillColor: unavailable ? "#747d78" : hasIssue ? "#cf8120" : "#24755d",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: isSelected ? 4 : 3,
          scale: isSelected ? 1.05 : 0.9,
          anchor: new google.maps.Point(0, 26),
          labelOrigin: new google.maps.Point(0, -3),
        },
        draggable: true,
        zIndex: isSelected ? 10 : 1,
      });
      marker.addListener("click", () => onSelect(location.id));
      marker.addListener("dragend", () => {
        const position = marker.getPosition();
        if (!position) return;
        const next = interfacePosition(position);
        onMove(location.id, next.x, next.y, position.lat(), position.lng());
        onSelect(location.id);
      });
      return marker;
    });
  }, [locations, mapReady, onMove, onSelect, selected]);

  useEffect(() => {
    if (!map.current) return;
    map.current.setZoom(Math.round(googleMapZoom + (zoom - 1) * 10));
  }, [zoom]);

  useEffect(() => {
    if (!map.current || selected === null) return;
    const location = locations.find((item) => item.id === selected);
    if (location) {
      map.current.panTo(mapPosition(location));
      if ((map.current.getZoom() ?? 16) < 18) map.current.setZoom(18);
    }
  }, [locations, selected]);

  if (googleMapsApiKey && !mapError) {
    return (
      <div className="map-viewport" aria-label="Interactive Google Map of UCD Belfield campus">
        <div ref={mapNode} className="google-api-map" />
        {!mapReady && <div className="map-loading">Loading Google Maps…</div>}
        <div className="drag-hint"><Icon name="locate" size={15} /> Drag any pin to its exact entrance</div>
      </div>
    );
  }

  return (
    <div className="map-viewport" aria-label="Interactive map of UCD Belfield campus">
      <div className="map-canvas" style={{ transform: `scale(${zoom})` }}>
        <iframe
          className="google-map"
          title="Google Maps roadmap of UCD Belfield campus"
          src="https://maps.google.com/maps?ll=53.3077,-6.2227&z=15&t=m&output=embed"
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className="map-tint" aria-hidden="true" />
        {locations.map((location) => {
          const unavailable = location.total === 0;
          const warning = location.total > location.working;
          const offset = fallbackMapOffset(location);
          return (
            <button
              className={`map-pin ${unavailable ? "unavailable" : warning ? "warning" : ""} ${selected === location.id ? "selected" : ""}`}
              key={location.id}
              style={{
                left: `calc(50% + ${offset.x}px)`,
                top: `calc(50% + ${offset.y}px)`,
              }}
              onClick={() => onSelect(location.id)}
              onPointerDown={(event) => {
                draggedPin.current = location.id;
                event.currentTarget.setPointerCapture(event.pointerId);
                onSelect(location.id);
              }}
              onPointerMove={(event) => {
                if (draggedPin.current !== location.id || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
                const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
                if (!bounds) return;
                const mapX = (event.clientX - (bounds.left + bounds.width / 2)) / zoom;
                const mapY = (event.clientY - (bounds.top + bounds.height / 2)) / zoom;
                const geo = geoFromMapOffset(mapX, mapY);
                const next = interfacePositionFromGeo(geo.lat, geo.lng);
                onMove(location.id, next.x, next.y, geo.lat, geo.lng);
              }}
              onPointerUp={(event) => {
                draggedPin.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
              onPointerCancel={() => {
                draggedPin.current = null;
              }}
              aria-label={`${location.name}, ${location.working} of ${location.total} working`}
            >
              <span className="pin-tooltip">{location.name}</span>
            </button>
          );
        })}
      </div>
      <div className="drag-hint"><Icon name="locate" size={15} /> Drag any pin to its exact entrance</div>
    </div>
  );
}

export default function App() {
  const [locations, setLocations] = useState<Location[]>(() => {
    const saved = localStorage.getItem("ucd-microwave-locations");
    if (!saved) return initialLocations;
    const parsed = JSON.parse(saved) as Location[];
    const withNewLocations = [
      ...parsed,
      ...initialLocations.filter((location) => !parsed.some((savedLocation) => savedLocation.id === location.id)),
    ];
    if (localStorage.getItem("ucd-map-position-version") === "3") return withNewLocations;
    localStorage.setItem("ucd-map-position-version", "3");
    return withNewLocations.map((location) => {
      const verified = initialLocations.find((item) => item.id === location.id);
      return verified
        ? { ...location, x: verified.x, y: verified.y, lat: verified.lat, lng: verified.lng }
        : location;
    });
  });
  const [selected, setSelected] = useState<number | null>(1);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "issues">("all");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Location | null>(null);
  const [zoom, setZoom] = useState(1);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [transferMessage, setTransferMessage] = useState("");
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem("ucd-microwave-locations", JSON.stringify(locations));
  }, [locations]);

  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
  }, []);

  const totals = useMemo(
    () => locations.reduce((sum, item) => ({ total: sum.total + item.total, working: sum.working + item.working }), { total: 0, working: 0 }),
    [locations],
  );

  const visibleLocations = locations.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(query.toLowerCase());
    const matchesFilter =
      filter === "all" || (filter === "available" && item.total > 0) || (filter === "issues" && item.total > item.working);
    return matchesSearch && matchesFilter;
  });

  const selectedLocation = locations.find((location) => location.id === selected) ?? null;
  const moveLocation = useCallback((id: number, x: number, y: number, lat: number, lng: number) => {
    setLocations((items) => items.map((item) => item.id === id ? { ...item, x, y, lat, lng } : item));
  }, []);

  const openEditor = (location?: Location) => {
    setDraft(
      location ?? {
        id: Math.max(...locations.map((item) => item.id), 0) + 1,
        name: "",
        detail: "",
        total: 1,
        working: 1,
        condition: "Good",
        x: 50,
        y: 50,
      },
    );
    setEditing(true);
  };

  const saveDraft = () => {
    if (!draft || !draft.name.trim()) return;
    setLocations((current) => {
      const exists = current.some((item) => item.id === draft.id);
      return exists ? current.map((item) => (item.id === draft.id ? draft : item)) : [...current, draft];
    });
    setSelected(draft.id);
    setEditing(false);
  };

  const installApp = async () => {
    if (!installPrompt) {
      setTransferMessage("On the published site, use your browser menu and choose “Install app” or “Add to Home Screen”.");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setTransferMessage(choice.outcome === "accepted" ? "App installed successfully." : "Installation cancelled.");
    setInstallPrompt(null);
  };

  const exportLocations = () => {
    const file = new Blob([JSON.stringify(locations, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ucd-microwave-map-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setTransferMessage("Editable map data downloaded.");
  };

  const importLocations = async (file?: File) => {
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text()) as unknown;
      if (!Array.isArray(imported) || !imported.length || !imported.every(isLocation)) {
        throw new Error("Invalid map data");
      }
      setLocations(imported);
      setSelected(imported[0].id);
      setTransferMessage(`${imported.length} editable locations imported.`);
    } catch {
      setTransferMessage("That file is not valid UCD microwave map data.");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <header className="brand">
          <div className="brand-mark"><Icon name="microwave" size={21} /></div>
          <div>
            <p className="eyebrow">UCD Campus Services</p>
            <h1>Microwave map</h1>
          </div>
        </header>

        <section className="summary-card">
          <div><strong>{totals.total}</strong><span>Total</span></div>
          <div><strong>{totals.working}</strong><span>Working</span></div>
          <div><strong>{totals.total - totals.working}</strong><span>Out of order</span></div>
        </section>

        <section className="app-tools" aria-label="App and data tools">
          <button className="install-app" onClick={installApp}><Icon name="install" size={17} /> Install app</button>
          <div className="data-actions">
            <button onClick={exportLocations} title="Download editable map data"><Icon name="download" size={16} /> Export</button>
            <button onClick={() => importInput.current?.click()} title="Import editable map data"><Icon name="upload" size={16} /> Import</button>
          </div>
          <a className="source-download" href={`${import.meta.env.BASE_URL}ucd-microwave-map-source.zip`} download>
            <Icon name="download" size={14} /> Download source code
          </a>
          <input
            ref={importInput}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importLocations(event.target.files?.[0])}
          />
          {transferMessage && <p className="tool-message" role="status">{transferMessage}</p>}
        </section>

        <div className="search-field">
          <Icon name="search" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a building" aria-label="Search buildings" />
          {query && <button className="clear-search" onClick={() => setQuery("")}><Icon name="close" size={14} /></button>}
        </div>

        <nav className="filters" aria-label="Filter locations">
          {(["all", "available", "issues"] as const).map((item) => (
            <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>
              {item === "all" ? "All" : item === "available" ? "Available" : "Issues"}
            </button>
          ))}
        </nav>

        <div className="location-heading">
          <span>Locations</span>
          <span>{visibleLocations.length}</span>
        </div>

        <div className="location-list">
          {visibleLocations.map((location) => {
            const hasIssue = location.total > location.working;
            return (
              <button
                className={`location-row ${selected === location.id ? "active" : ""}`}
                key={location.id}
                onClick={() => setSelected(location.id)}
              >
                <span className={`list-marker ${location.total === 0 ? "empty" : hasIssue ? "issue" : ""}`}>{location.id}</span>
                <span className="location-copy">
                  <strong>{location.name}</strong>
                  <small>{location.total === 0 ? "No microwaves reported" : `${location.working} of ${location.total} working`}</small>
                </span>
                <span className="row-arrow"><Icon name="arrow" size={16} /></span>
              </button>
            );
          })}
        </div>

        <button className="add-location" onClick={() => openEditor()}><Icon name="plus" /> Add location</button>
      </aside>

      <section className="map-area">
        <div className="map-topbar">
          <div>
            <p className="eyebrow">Dublin 4, Ireland</p>
            <h2>Belfield campus</h2>
          </div>
          <div className="last-updated"><span className="live-dot" /> Updated just now</div>
        </div>

        <a
          className="google-map-link"
          href="https://www.google.com/maps/search/?api=1&query=UCD+Belfield+Campus"
          target="_blank"
          rel="noreferrer"
        >
          View full map
          <Icon name="arrow" size={14} />
        </a>

        <CampusMap
          locations={locations}
          selected={selected}
          onSelect={setSelected}
          onMove={moveLocation}
          zoom={zoom}
        />

        <div className="map-actions">
          <button title="Map layers"><Icon name="layers" /></button>
          <button title="Locate me"><Icon name="locate" /></button>
          <span />
          <button onClick={() => setZoom((value) => Math.min(value + 0.1, 1.35))} title="Zoom in"><Icon name="plus" /></button>
          <button onClick={() => setZoom((value) => Math.max(value - 0.1, 0.9))} title="Zoom out"><Icon name="minus" /></button>
        </div>

        <div className="legend">
          <span><i className="legend-dot" /> Available</span>
          <span><i className="legend-dot issue" /> Some out of order</span>
          <span><i className="legend-square" /> None reported</span>
        </div>

        {selectedLocation && (
          <article className="detail-card">
            <button className="detail-close" onClick={() => setSelected(null)} aria-label="Close details"><Icon name="close" /></button>
            <div className="detail-title">
              <span className={`detail-number ${selectedLocation.total > selectedLocation.working ? "issue" : selectedLocation.total === 0 ? "empty" : ""}`}>{selectedLocation.id}</span>
              <div><p>Building</p><h3>{selectedLocation.name}</h3><small>{selectedLocation.detail}</small></div>
            </div>
            <div className="detail-stats">
              <div><span>Working</span><strong>{selectedLocation.total ? `${selectedLocation.working} / ${selectedLocation.total}` : "None"}</strong></div>
              <div><span>Condition</span><strong>{selectedLocation.condition}</strong></div>
            </div>
            {selectedLocation.total > selectedLocation.working && (
              <p className="issue-note">{selectedLocation.total - selectedLocation.working} microwave{selectedLocation.total - selectedLocation.working > 1 ? "s are" : " is"} currently out of order.</p>
            )}
            <button className="edit-button" onClick={() => openEditor(selectedLocation)}><Icon name="edit" /> Edit details</button>
          </article>
        )}
      </section>

      {editing && draft && (
        <div className="modal-backdrop" onMouseDown={() => setEditing(false)}>
          <form className="edit-panel" onSubmit={(event) => { event.preventDefault(); saveDraft(); }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="edit-header">
              <div><p className="eyebrow">Campus directory</p><h2>{locations.some((item) => item.id === draft.id) ? "Edit location" : "Add location"}</h2></div>
              <button type="button" onClick={() => setEditing(false)} aria-label="Close editor"><Icon name="close" /></button>
            </div>
            <label>Building name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Newman Building" /></label>
            <label>Area or room<input value={draft.detail} onChange={(event) => setDraft({ ...draft, detail: event.target.value })} placeholder="Optional location detail" /></label>
            <div className="field-grid">
              <label>Total microwaves<input type="number" min="0" value={draft.total} onChange={(event) => {
                const total = Number(event.target.value);
                setDraft({ ...draft, total, working: Math.min(draft.working, total), condition: total === 0 ? "—" : draft.condition === "—" ? "Good" : draft.condition });
              }} /></label>
              <label>Working<input type="number" min="0" max={draft.total} value={draft.working} onChange={(event) => setDraft({ ...draft, working: Math.min(Number(event.target.value), draft.total) })} /></label>
            </div>
            <label>Condition<select value={draft.condition} disabled={draft.total === 0} onChange={(event) => setDraft({ ...draft, condition: event.target.value as Condition })}>
              <option>Very good</option><option>Good</option><option>Fair</option><option>Needs attention</option><option>—</option>
            </select></label>
            <div className="edit-tip"><Icon name="locate" size={17} /><span>New locations start in the centre of campus. Select the saved pin and drag it to its exact building.</span></div>
            <div className="edit-actions">
              {locations.some((item) => item.id === draft.id) && <button type="button" className="delete" onClick={() => {
                setLocations((items) => items.filter((item) => item.id !== draft.id));
                setSelected(null);
                setEditing(false);
              }}>Delete</button>}
              <button type="button" className="cancel" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" className="save">Save changes</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
