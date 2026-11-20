"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LngLatBounds, Map, Marker, Popup, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Activity } from "@/lib/itinerary";

export default function TripMap({ activities }: { activities: Activity[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const located = useMemo(
    () => activities.filter((activity) => activity.place),
    [activities],
  );

  useEffect(() => {
    if (!container.current || located.length === 0) return;
    let map: Map;
    try {
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      map = new Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [located[0].place!.longitude, located[0].place!.latitude],
        zoom: 12,
      });
      map.on("error", () => setFailed(true));
      const bounds = new LngLatBounds();
      for (const [index, activity] of located.entries()) {
        const place = activity.place!;
        const position: [number, number] = [place.longitude, place.latitude];
        const pin = document.createElement("button");
        pin.type = "button";
        pin.textContent = String(index + 1);
        pin.setAttribute(
          "aria-label",
          `${index + 1}. ${activity.title}: ${place.name}`,
        );
        pin.className =
          "flex size-12 items-center justify-center rounded-full border-2 border-white bg-primary font-semibold text-primary-foreground shadow";
        new Marker({ element: pin })
          .setLngLat(position)
          .setPopup(
            new Popup({ offset: 20 }).setText(
              `${activity.title}: ${place.name}${place.address ? `, ${place.address}` : ""}`,
            ),
          )
          .addTo(map);
        bounds.extend(position);
      }
      if (located.length > 1)
        map.fitBounds(bounds, { padding: 40, maxZoom: 13 });
    } catch {
      const timer = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(timer);
    }
    return () => map.remove();
  }, [located]);

  if (located.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Add a place to an activity to see it on the map.
      </p>
    );
  return (
    <div className="space-y-4 md:space-y-5">
      {failed && (
        <p role="status" className="text-sm text-destructive">
          The map could not load. Place details remain below.
        </p>
      )}
      <div
        ref={container}
        className="h-[280px] w-full overflow-hidden rounded-xl border bg-[var(--trip-mist)] [&_.maplibregl-ctrl-attrib-button]:bg-[url('/icons/info.svg')] [&_.maplibregl-popup-close-button]:bg-[url('/icons/x.svg')] [&_.maplibregl-popup-close-button]:bg-size-[1rem] [&_.maplibregl-popup-close-button]:bg-center [&_.maplibregl-popup-close-button]:bg-no-repeat [&_.maplibregl-popup-close-button]:[font-size:0]"
        aria-label="Map of places on the selected day"
      />
      <ul className="divide-y rounded-xl border bg-card">
        {located.map((activity) => (
          <li
            key={activity.id}
            className="space-y-1 px-3.5 py-3 break-words md:p-4"
          >
            <p className="text-[0.9375rem] leading-5 font-semibold">
              {activity.place!.name}
            </p>
            <p className="text-[0.8125rem] leading-5 text-muted-foreground">
              {activity.title}
            </p>
            {activity.place!.address && (
              <p className="text-[0.8125rem] leading-5 text-muted-foreground">
                {activity.place!.address}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Place data ©{" "}
        <a
          className="underline"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap contributors
        </a>
        .
      </p>
    </div>
  );
}
