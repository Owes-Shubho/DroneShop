# Drone catalog — features and prices

Reference sheet for the SkyCart shop: nine drones from DJI, Parrot, Autel and Yuneec, with the matching photo in `client/public/images/drones/`.

> **Verify before selling.** Specs are manufacturer-published figures as generally reported. Prices are **approximate launch prices in USD** (mostly rounded to the nearest dollar); several are older models whose current new/used prices differ. A web search for a few of these returned conflicting figures (for example Mini 4 Pro, Mini 2, Mavic Air 2 and Inspire 2), so please confirm each price and spec against DJI/Autel/Parrot/Yuneec or your supplier before publishing. The "Shop price" column is a suggested starting point, not a quote.

## Summary

| # | Drone | Brand | Category | Launch price (approx.) | Suggested shop price | Flight time | Camera | Weight |
|---|---|---|---|---|---|---|---|---|
| 1 | Mini 2 | DJI | Camera Drones | $449 | $449 | ~31 min | 4K / 30fps | 242 g |
| 2 | Mini 4 Pro | DJI | Camera Drones | $759 | $759 | ~34 min | 4K / 100fps | <249 g |
| 3 | Mavic Air 2 | DJI | Camera Drones | $799 | $799 | ~34 min | 4K / 60fps, 48MP stills | 570 g |
| 4 | Mavic 3 | DJI | Camera Drones | $2,199 | $2,199 | ~46 min | 4/3 CMOS, 5.1K | 895 g |
| 5 | Inspire 2 | DJI | Industrial Drones | ~$3,299 | $3,299 | ~27 min | Interchangeable (X5S/X7) | ~3.4 kg |
| 6 | Phantom 3 Advanced | DJI | Camera Drones | $799 | $349 (used/older stock) | ~23 min | 1080p / 60fps | 1,280 g |
| 7 | Anafi | Parrot | Camera Drones | $699 | $599 | ~25 min | 4K HDR | 320 g |
| 8 | EVO II Pro | Autel | Camera Drones | ~$1,795 | $1,795 | ~40 min | 1" CMOS 20MP, 6K | ~1.1 kg |
| 9 | Typhoon H | Yuneec | Camera Drones | ~$1,299 | $899 (older stock) | ~25 min | 4K | ~1.9 kg |

## Details

### 1. DJI Mini 2 — `dji-mini-2.jpg`
- **Best for:** beginners and travel; sub-250 g.
- **Features:** 4K/30 video, 3-axis gimbal, 12MP stills, GPS return-to-home, OcuSync 2.0 video link (up to about 10 km depending on region), QuickShots modes.
- **Specs:** ~31 min flight, 242 g, max speed ~16 m/s.
- **Price:** ~$449 (Fly More combo higher).

### 2. DJI Mini 4 Pro — `dji-mini-4-pro.jpg`
- **Best for:** enthusiasts who want a pocket-sized drone with pro features.
- **Features:** 4K up to 100fps, omnidirectional obstacle sensing, ActiveTrack, true vertical shooting, O4 video link (up to ~20 km).
- **Specs:** ~34 min flight with the standard battery (longer with the Plus battery in regions where it's sold), under 249 g.
- **Price:** ~$759 with the standard controller.

### 3. DJI Mavic Air 2 — `dji-mavic-air-2.jpg`
- **Best for:** hobbyists wanting better image quality than a Mini.
- **Features:** 48MP photos, 4K/60 video, 1/2" sensor, 3-axis gimbal, ActiveTrack 3.0, obstacle sensing front/rear/down, foldable body.
- **Specs:** ~34 min flight, 570 g, up to ~10 km video link.
- **Price:** ~$799.

### 4. DJI Mavic 3 — `dji-mavic-3.jpg`
- **Best for:** professional aerial photo/video.
- **Features:** 4/3-inch Hasselblad CMOS camera, up to 5.1K video, dual camera system with a tele lens, omnidirectional obstacle sensing, O3+ video link (up to ~15 km).
- **Specs:** ~46 min flight, 895 g.
- **Price:** ~$2,199 (Cine version higher).

### 5. DJI Inspire 2 — `dji-inspire-2.jpg`
- **Best for:** film and broadcast production.
- **Features:** swappable camera heads (e.g. Zenmuse X5S, X7), dual-operator control, retractable landing gear, 360° gimbal view, dual batteries, up to 5.2K CinemaDNG/ProRes recording (with licenses).
- **Specs:** ~27 min flight (varies by camera), ~3.4 kg with batteries, max speed ~94 km/h.
- **Price:** ~$3,299 for the aircraft; cameras and licenses are extra.

### 6. DJI Phantom 3 Advanced — `dji-phantom-3-advanced.jpg`
- **Best for:** budget buyers; older generation.
- **Features:** 1080p/60 video, 3-axis gimbal, 12MP stills, GPS + vision positioning, Lightbridge-free Wi-Fi-based link (short range).
- **Specs:** ~23 min flight, 1,280 g.
- **Price:** ~$799 at launch (2015); shown here as discounted/older stock.

### 7. Parrot Anafi — `parrot-anafi.jpg`
- **Best for:** inspection and creative shots; unusual 180° up-tilt gimbal.
- **Features:** 4K HDR video, 21MP stills, 2.8x lossless zoom, foldable, quiet motors, USB-C charging.
- **Specs:** ~25 min flight, 320 g, ~4 km range.
- **Price:** ~$699 at launch (2018). The later Anafi USA is a different, much pricier public-safety model.

### 8. Autel EVO II Pro — `autel-evo-ii-pro.jpg`
- **Best for:** high-quality aerial imaging as a non-DJI alternative.
- **Features:** 1-inch 20MP CMOS, 6K video, adjustable aperture, 12 obstacle-avoidance sensors, foldable body.
- **Specs:** ~40 min flight, ~1.1 kg, ~9 km range.
- **Price:** ~$1,795 (bundles/rugged kits ~$2,100).

### 9. Yuneec Typhoon H — `yuneec-typhoon-h.jpg`
- **Best for:** collectors/budget buyers wanting a hexacopter; discontinued line.
- **Features:** six-rotor design (can land safely on five), retractable landing gear, 360° rotating 4K camera, Intel RealSense obstacle avoidance on some versions.
- **Specs:** ~25 min flight, ~1.9 kg.
- **Price:** ~$1,299 at launch; treat as older stock.

## Notes for the shop
- The `category` values in the database are limited to: Camera Drones, Racing Drones, Toy Drones, Industrial Drones, Accessories. The Inspire 2 is mapped to Industrial Drones; the rest to Camera Drones.
- To show these on the site, set each product's `image` to `/images/drones/<file>.jpg` (Vite serves `client/public` from the site root).
- Image credits and licenses are in `client/public/images/drones/CREDITS.md`. Photos are CC BY-SA, so keep the credit (for example in the site footer or on each product page) when displaying them publicly.
