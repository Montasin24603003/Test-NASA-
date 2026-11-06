# Martian Map – Interplanetary Survival Guide (NASA Space Apps 2026)

## Contents
- `web/index.html` – the full interactive 3D Mars map (single file). Open online; it loads three.js and fonts from CDNs.
  - Seven sides of Mars, 24 landmarks with survival ratings.
  - Select **Jezero Crater** → "Open terrain lab": 3D terrain from your DEM, hazard layers, ML layers, 3 routes.
  - Your Jezero data + ML results are embedded as `const JZ = {...}` inside the script.
- `ml/ml_pipeline.py` – ML pipeline that produced the embedded data (gradient-boosted hazard surrogate, k-means terrain classes, route comparison).
- `outputs/` – `jezero_data.json` (compact data for the web page), `ml_hazard_prediction.tif`, `ml_terrain_classes.tif` (full 1024×1024 rasters).

## Re-run the ML
```
pip install -r ml/requirements.txt
python ml/ml_pipeline.py <folder with jezero_dem_1024.tif, jezero_slope.tif, jezero_roughness.tif, jezero_hazard_score.tif, jezero_routes_v03.json> outputs
```

## Integrate into your project
1. **Iframe / separate page:** host `web/index.html` as is.
2. **Update the data:** replace the JSON after `const JZ=` in `web/index.html` with the new `outputs/jezero_data.json` content.
3. **Offline use:** download three.js r128 (`three.min.js`) and change the `<script src=...cdnjs...>` tag to the local file.
4. **Add more sites:** run the pipeline on another DEM, then add a landmark in the `P` array and a new `JZ`-style block.

## Results (spatial-block cross-validation, 4 folds)
- Hazard surrogate: R² 0.998, MAE 0.009, class accuracy 98.3% (majority baseline 63.3%).
- Risk-aware route: ~29% lower risk-weighted cost than the shortest route.
- Robust A* vs nominal A*: +0.122% [−0.158, +0.411] → not significant.

## Honest limitations
The hazard label is a formula of slope and roughness, so the model re-learns that formula from elevation alone. It is a fast surrogate, not independent validation of rover safety. Data covers one ~1 km Jezero patch. Terrain data: NASA/USGS HiRISE. Planet-wide globe terrain is procedural, not real elevation.
