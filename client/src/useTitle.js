import { useEffect } from 'react';

// Sets the tab title and meta description for the current page.
export default function useTitle(title, description) {
  useEffect(() => {
    document.title = title ? `${title} — SkyCart` : 'SkyCart — Drone Shop';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = description || 'Shop camera, racing, toy and industrial drones with fast shipping.';
  }, [title, description]);
}
