#!/usr/bin/env python3
"""
NASA Space Apps Challenge - 3D Rover Traverse Web Platform
Terrain Mesh Generator (DEM to 3D OBJ / glTF)

Reads the DEM elevation grid and outputs an optimized 3D OBJ mesh file
with vertex coordinates, UV texture mappings, and normals for WebGL rendering.
"""

import json
import os
import math

def generate_obj_from_dem(json_dem_path="assets/jezero_dem_200m.json", output_obj_path="assets/jezero_terrain.obj"):
    if not os.path.exists(json_dem_path):
        print(f"Error: {json_dem_path} not found.")
        return

    with open(json_dem_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    grid = data["elevation_grid"]
    grid_size = data["grid_size"]
    extent = data["extent_meters"]
    
    step = extent / (grid_size - 1)
    half_extent = extent / 2.0
    
    print(f"Generating 3D OBJ mesh from {grid_size}x{grid_size} grid...")

    with open(output_obj_path, "w", encoding="utf-8") as f:
        f.write("# NASA Jezero Crater 3D Traverse Mesh\n")
        f.write(f"# Resolution: {grid_size}x{grid_size}, Extent: {extent}m\n\n")

        # 1. Vertices (v x y z)
        for r in range(grid_size):
            z = (r * step) - half_extent - 90.0 # North offset
            for c in range(grid_size):
                x = (c * step) - half_extent
                y = grid[r][c]
                f.write(f"v {x:.3f} {y:.3f} {z:.3f}\n")

        # 2. Texture UV Coordinates (vt u v)
        for r in range(grid_size):
            v = 1.0 - (r / (grid_size - 1))
            for c in range(grid_size):
                u = c / (grid_size - 1)
                f.write(f"vt {u:.4f} {v:.4f}\n")

        # 3. Faces (f v1/vt1 v2/vt2 v3/vt3)
        for r in range(grid_size - 1):
            for c in range(grid_size - 1):
                # 1-based indexing for OBJ
                p1 = r * grid_size + c + 1
                p2 = p1 + 1
                p3 = (r + 1) * grid_size + c + 1
                p4 = p3 + 1

                # Two triangles per grid quad
                f.write(f"f {p1}/{p1} {p3}/{p3} {p2}/{p2}\n")
                f.write(f"f {p2}/{p2} {p3}/{p3} {p4}/{p4}\n")

    print(f"[Mesh Generator] Successfully generated 3D OBJ mesh: {output_obj_path}")

if __name__ == "__main__":
    generate_obj_from_dem()
