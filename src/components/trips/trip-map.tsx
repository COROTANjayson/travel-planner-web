"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LngLatBounds, Map, Marker, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Activity } from "@/lib/itinerary";

export default function TripMap({ activities }: { activities: Activity[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const located = useMemo(() => activities.filter((activity) => activity.place), [activities]);

  useEffect(() => {
    if (!container.current || located.length === 0) return;
    let map: Map;
    try {
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      map = new Map({ container: container.current, style: "https://tiles.openfreemap.org/styles/liberty",
        center: [located[0].place!.longitude, located[0].place!.latitude], zoom: 12 });
      map.on("error", () => setFailed(true));
      const bounds = new LngLatBounds();
      for (const activity of located) {
        const position: [number, number] = [activity.place!.longitude, activity.place!.latitude];
        new Marker().setLngLat(position).addTo(map);
        bounds.extend(position);
      }
      if (located.length > 1) map.fitBounds(bounds, { padding: 40, maxZoom: 13 });
    } catch {
      const timer = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(timer);
    }
    return () => map.remove();
  }, [located]);

  if (located.length === 0) return <p className="text-sm text-muted-foreground">Add a place to an activity to see it on the map.</p>;
  return <div className="space-y-3">
    {failed && <p role="status" className="text-sm text-destructive">The map could not load. Place details remain below.</p>}
    <div ref={container} className="h-64 w-full overflow-hidden rounded-lg border sm:h-80" aria-label="Map of places on this activity page" />
    <ul className="space-y-1 text-sm">{located.map((activity) => <li key={activity.id} className="break-words">
      <strong>{activity.title}:</strong> {activity.place!.name}, {activity.place!.address}
    </li>)}</ul>
    <p className="text-xs text-muted-foreground">Place data © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>.</p>
  </div>;
}
