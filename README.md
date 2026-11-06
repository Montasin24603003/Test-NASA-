# Mars Survival Map

This website was created for the NASA Space Apps Challenge. Our challenge is **Interplanetary Survival Guide: Martian Map**.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mars-guide-buddy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ab2f2311-524f-4f1a-b83b-1182f8126890).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Interplanetary Survival Guide — NASA Space Apps 2026

This build combines the Lovable/TanStack application, the local Mars 3D asset, and the NASA dataset pages supplied in the project bundle.

### Data pipeline

`NASA Open Data metadata → provenance registry → planning layers → interactive Mars explorer → survival simulator`

The UI exposes four planning layers:
- Terrain classification
- Thermal environment
- Radiation environment
- Mineralogy / spectroscopy

The uploaded NASA archive contains dataset web pages/metadata rather than the complete raw instrument archives. For that reason, the current planning metrics are explicitly labeled as demo/model values. The source links in **NASA Data** open the corresponding NASA Open Data Portal records.

### Run

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Main demo flow

1. Open **Mission Map**.
2. Rotate the 3D Mars model and select a candidate sector.
3. Toggle terrain / hazard / resource / rover / route layers.
4. Open **Clock & Compass** (`/mars-clock`) to view real-time Martian solar time, Sol counters, analog dial, and 3D planetary compass.
5. Open **NASA Data** to show provenance and the data-fusion pipeline.
6. Open **Survival Simulator** and change crew, duration, water, power, shielding and dust conditions.
7. Use the existing **Marswalk** presentation mode for the final judging story.

### Mars Local Time Clock & 3D Compass

This project implements a scientific Martian chronometer and navigation system:
- **Mars Sol Date (MSD) & Sol Number**: Continuous count of Martian solar days (epoch MSD 44796.0 at Jan 6 2000 00:00:00 TT).
- **Martian Sol Day Length**: Calibrated to 24 hours, 39 minutes, and 35.244 seconds (88,775.244s, ratio 1.027491252 to Earth solar day).
- **MTC, LMST, and LTST**: Coordinated Mars Time at Airy-0 meridian (0° lon), Local Mean Solar Time, and Local True Solar Time (sundial time) calculated via the Allison & McEwen (2000) NASA Mars24 formulation.
- **Equation of Time (EOT)**: Compensates for Mars's high orbital eccentricity ($e = 0.0934$) and axial tilt ($25.19^\circ$), shifting true solar noon by up to 51 Martian minutes.
- **Solar Longitude ($L_s$) & Martian Seasons**: Tracks North Spring Equinox ($0^\circ$), North Summer Solstice ($90^\circ$), North Autumn Equinox ($180^\circ$), and North Winter Solstice ($270^\circ$).
- **Dual Analog & Digital Display**: High-precision 24-hour and 12-hour analog solar dial with day/night illumination arc and digital telemetry.
- **Interactive 3D Mars Compass**: Three.js WebGL compass with touch/mouse rotation, digital bearing, degree slider, step adjustment, and reset-to-north.
- **Planetary Magnetism Distinction**: Clearly differentiates True Geographic North (Mars spin axis) from localized crustal remnant paleomagnetic anomalies (MGS/MAVEN data), explaining why Earth-style magnetic needles fail on Mars.
- **Shared Location Selector**: Connects landing sites (Jezero, Gale, Olympus Mons, Valles Marineris, etc.) or custom coordinates to both time and compass navigation.

### Asset provenance

The bundled Mars model comes from the supplied `mars.zip` package. Its GLTF metadata identifies Nestaeric as the author and CC BY 4.0 as the model license. Keep the attribution visible in the project if you redistribute the asset.
