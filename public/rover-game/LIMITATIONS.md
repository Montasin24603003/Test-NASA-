# SIMULATION APPROXIMATIONS & ENGINEERING LIMITATIONS

**Project:** ROVER EXPEDITION // Planetary Robotics & Scientific Simulation Engine  
**Affiliation:** NASA Space Apps Challenge  

To maintain the highest level of scientific integrity, this document explicitly records all engineering approximations, simplifications, and trade-offs made between strict continuum physics and real-time 120 Hz browser execution.

---

## 1. MOBILITY & SPEED GROUND HONESTY

### 1.1 Real Perseverance Traverse Speed
- **NASA Mars 2020 Flight Truth:** The Perseverance rover drives at a nominal top speed of **~4.2 cm/s (0.042 m/s / 0.15 km/h)** on flat, firm ground. At this rate, traversing 100 meters takes approximately 40 minutes of continuous driving.
- **Simulation Implementation:** The physical equations in `src/sim/` calculate actuator torques and wheel angular dynamics based on the true 0.042 m/s mechanical baseline.
- **Time Acceleration & Gameplay Gear:** To make planetary exploration engaging within a 15–30 minute browser session:
  1. **True Time Acceleration (1x, 2x, 5x, 10x, 25x):** Executes multiple deterministic 120 Hz fixed-dt sub-steps within the browser frame budget, preserving exact momentum and energy integrals.
  2. **Gameplay Mobility Gear (Default OFF):** An optional high-speed gear ratio (~5.4 m/s) designed for rapid traversal, explicitly marked in the UI as **`[NOT REAL PERSEVERANCE]`**.

---

## 2. ELECTRICAL POWER SYSTEM TRUTH

### 2.1 Multi-Mission Radioisotope Thermoelectric Generator (MMRTG)
- **NASA Mars 2020 Flight Truth:** Perseverance is **exclusively powered by an MMRTG** containing 4.8 kg of Plutonium-238 dioxide, producing approximately 110 W of electrical power day and night. It has **zero solar panels**.
- **Dust Storm Consequences:** Atmospheric dust storms do not degrade the MMRTG's electrical power output. Instead, they drop ambient temperatures (increasing survival heater demand), reduce atmospheric visibility, and degrade optical Visual Odometry.
- **Simulation Implementation:** The MMRTG is the sole primary electrical source (110 W continuous).
- **Solar-Assist Mode (Default OFF):** An optional solar panel toggle is provided in the Garage/Settings, clearly labeled in all telemetry and UI badges as **`[NOT REAL PERSEVERANCE — GAMEPLAY AID ONLY]`**.

---

## 3. TERRAMECHANICS & SOIL-WHEEL CONTACT

### 3.1 Analytical Formulation vs. Granular DEM
- **Full Discrete Element Method (DEM):** Simulating millions of individual Martian sand grains with friction, cohesion, and inter-particle collisions requires high-performance multi-GPU clusters and cannot run in a client browser at 120 Hz.
- **Analytical Bekker-Wong Formulation:** The simulation employs classical continuum terramechanics equations (Bekker pressure-sinkage, Janosi-Shields shear displacement, and compaction rolling resistance) evaluated at the wheel contact patch. This captures all key physical trends (monotonic sinkage ordering, slip-digging, drawbar pull drop in dunes) with $<0.01\text{ ms}$ computation time per step.

### 3.2 Rigid Wheel Approximation
- NASA Perseverance wheels are machined from a single piece of flight-grade aluminum with 48 titanium chevron grousers. The structural radial compliance is minimal compared to the deformable Martian regolith, making the rigid-wheel analytical assumption physically accurate for Jezero Crater terrain.

---

## 4. MULTI-BODY KINEMATICS VS FULL MULTI-BODY DAE

### 4.1 Rocker-Bogie Linkage Treatment
- The full Perseverance mobility assembly consists of 14 kinematic links (chassis, 2 rockers, 2 bogies, 6 wheel spindles, differential bar, and pushrods).
- Solving full Differential-Algebraic Equations (DAEs) with Lagrange multipliers in real-time can introduce constraint drift or require small timesteps ($>1000\text{ Hz}$).
- In this simulation, the rocker-bogie mechanism is solved through kinematic angle constraints and normalized load distribution:
  $$\theta_{\text{chassis}} = \frac{1}{2}(\theta_{\text{rocker, L}} + \theta_{\text{rocker, R}})$$
  This guarantees exact equal normal load distribution across all 6 wheels without numerical constraint instability.

---

## 5. ATMOSPHERIC & THERMAL MODELS

### 5.1 Barometric Profile & Meteorology
- **1D Hydrostatic Model:** Atmospheric pressure is modeled via the 1D hydrostatic barometric equation ($P(z) = P_0 e^{-z/H}$) rather than a 3D General Circulation Model (GCM) Navier-Stokes simulation.
- **Diurnal Temperature Fit:** Surface temperature follows an analytical harmonic fit calibrated to NASA Mars 2020 MEDA sensor observations, capturing the authentic peak at 14:00 LST and minimum at 04:00 LST.

### 5.2 Lumped Capacitance Thermal Network
- The 4-node lumped thermal capacitance model (WEB/Avionics, Battery, Motors, Mast) represents regional thermal averages rather than a fine-mesh finite-element thermal model. Heat capacity, radiative emission to deep Martian sky, and convective cooling in thin CO2 match thermal time constants within $\pm 5\%$.

---

## 6. SCIENTIFIC INSTRUMENTS

### 6.1 SuperCam LIBS Elemental Spectroscopy
- The SuperCam simulation models calibrated elemental weight percentages ($SiO_2, FeO, Al_2O_3, CaO, MgO, TiO_2, Na_2O, K_2O$) and characteristic atomic emission lines (nm) for Mars-analog minerals. It simulates physical stand-off laser physics rather than processing raw detector spectrometer counts.
