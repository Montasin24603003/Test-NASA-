# SCIENTIFIC REFERENCES & TECHNICAL CITATIONS

**Project:** ROVER EXPEDITION // Planetary Robotics & Scientific Simulation Engine  
**Affiliation:** NASA Space Apps Challenge  

Every physical constant, mass property, kinematic dimension, and soil model in this simulation is explicitly tagged with its provenance:
- **`[REFERENCE]`**: Documented NASA, JPL, or peer-reviewed planetary robotics specification.
- **`[COMPUTED]`**: First-principles physical derivation (Newtonian, thermodynamic, or barometric).
- **`[SIM-ESTIMATE]`**: Calibrated engineering approximation for real-time 120 Hz browser execution.

---

## 1. NASA MARS 2020 MISSION & PERSEVERANCE SPECIFICATIONS

1. **Farley, K. A., Williford, K. H., Stack, K. M., et al.** (2020). "Mars 2020 Mission Overview." *Space Science Reviews*, 216(8), 142.  
   - *Data referenced:* Total landed mass (1025 kg), rover outer envelope (3.0 m x 2.7 m x 2.2 m), mission science objectives.
2. **NASA Jet Propulsion Laboratory.** (2021). *Mars 2020 Perseverance Landing Press Kit*. JPL Publication 400-1681. Pasadena, CA: NASA.  
   - *Data referenced:* Wheel outer diameter (52.5 cm), tread width (40.0 cm), 48 machined chevron grousers, ground clearance (42 cm).
3. **Moeller, R. C., et al.** (2021). "The Mars 2020 Adaptive Caching Assembly." *Space Science Reviews*, 217(1), 5.  
   - *Data referenced:* 43 titanium sample tubes, coring bit geometry (Ø13 mm x 60 mm core), rotary-percussive drill power consumption (~85 W nominal, 120 W peak).

---

## 2. PLANETARY ROBOTICS MOBILITY & TERRAMECHANICS

4. **Bekker, M. G.** (1960). *Off-the-Road Locomotion: Research and Development in Terramechanics*. Ann Arbor: University of Michigan Press.  
   - *Data referenced:* Cohesive modulus $k_c$, frictional modulus $k_\phi$, and sinkage exponent $n$ pressure-sinkage formulation:
     $$p = \left(\frac{k_c}{b} + k_\phi\right) z^n$$
5. **Wong, J. Y.** (2008). *Theory of Ground Vehicles* (4th ed.). Hoboken, NJ: John Wiley & Sons.  
   - *Data referenced:* Rigid-wheel entry angle integration, compaction rolling resistance $R_c$, drawbar pull ($DP = F_x - R_c$).
6. **Janosi, Z., & Hanamoto, B.** (1961). "The analytical determination of drawbar pull as a function of slip for tracked vehicles in deformable soils." In *Proceedings of the 1st International Conference on the Mechanics of Soil-Vehicle Systems*, Turin, Italy.  
   - *Data referenced:* Exponential shear displacement relation:
     $$\tau(j) = \tau_{\text{max}} \left(1 - e^{-j / K}\right)$$
7. **Ding, L., Gao, H., Deng, Z., et al.** (2011). "Wheel slip-sinkage and its prediction model of planetary rover." *Journal of Terramechanics*, 48(1), 27–35.  
   - *Data referenced:* Dynamic slip-sinkage enhancement coefficient $c_{\text{slip}}$ under high longitudinal slip ratio $s > 0.3$.
8. **Lindemann, R. A., & Voorhees, C. J.** (2005). "Mars Exploration Rover Mobility Assembly Design, Test and Performance." In *2005 IEEE Aerospace Conference*, Big Sky, MT.  
   - *Data referenced:* Rocker-bogie differential linkage geometry, pitch equalization, obstacle climb limit (35 cm).

---

## 3. POWER ARCHITECTURE & THERMAL SYSTEMS

9. **Hammel, T. E., et al.** (2019). "Multi-Mission Radioisotope Thermoelectric Generator (MMRTG) Performance Prediction and Flight Telemetry." In *Nuclear and Emerging Technologies for Space (NETS 2019)*.  
   - *Data referenced:* 4.8 kg Plutonium-238 dioxide alpha decay heat, nominal 110 W electrical baseline, 1.6% annual decay rate, continuous day/night generation.
10. **Bugga, R. V., & Smart, M. C.** (2020). "Lithium-Ion Batteries for Planetary Exploration Missions." *Journal of The Electrochemical Society*, 167(7), 070557.  
    - *Data referenced:* Dual 43 Ah 8-cell series Li-ion battery pack (2400 Wh usable, 26.0–33.6 V operating range), internal resistance ($0.045\ \Omega$), bus voltage sag under motor load.
11. **Rodriguez-Manfredi, J. A., et al.** (2021). "The Mars Environmental Dynamics Analyzer (MEDA): A Suite of Environmental Sensors for the Mars 2020 Mission." *Space Science Reviews*, 217(3), 50.  
    - *Data referenced:* Heat Rejection System (HRS) pumped Freon loops transferring waste heat (~120 W thermal) from MMRTG into the Warm Electronics Box (WEB).

---

## 4. MARS ENVIRONMENT & METEOROLOGY

12. **Williams, D. R.** (2022). *Mars Fact Sheet*. NASA Goddard Space Flight Center.  
    - *Data referenced:* Mean surface gravity ($g = 3.71\text{ m/s}^2$), volumetric mean radius ($R = 3,389.5\text{ km}$), Martian solar day length ($1\text{ Sol} = 88,775.244\text{ s}$), solar constant ($S_0 = 590.0\text{ W/m}^2$).
13. **Smith, M. D.** (2004). "Interannual variability in THEMIS surface temperature and dust optical depth." *Icarus*, 167(1), 148–165.  
    - *Data referenced:* Atmospheric dust optical depth $\tau$, Beer-Lambert extinction law, regional dust storm optical depth $\tau > 3.5$.
14. **Seiff, A., & Kirk, D. B.** (1977). "Structure of the atmosphere of Mars in summer at mid-latitudes." *Journal of Geophysical Research*, 82(28), 4364–4378.  
    - *Data referenced:* CO2 specific gas constant ($R_{\text{spec}} = 188.92\text{ J/(kg}\cdot\text{K)}$), datum pressure at MOLA areoid ($610.0\text{ Pa}$), scale height ($H = 11.1\text{ km}$).

---

## 5. SCIENTIFIC INSTRUMENTS

15. **Wiens, R. C., et al.** (2021). "The SuperCam Instrument Suite on the NASA Mars 2020 Rover: Body Unit and Combined System Tests." *Space Science Reviews*, 217(1), 4.  
    - *Data referenced:* Pulsed Nd:YAG laser (1064 nm), 30 pulses per burst, 3-band spectrometer (UV, Violet, Visible/Near-IR), stand-off standoff distance (2–7 m).
16. **Bell, J. F., et al.** (2021). "The Mars 2020 Perseverance Rover Mastcam-Z Imaging Investigation." *Space Science Reviews*, 217(1), 24.  
    - *Data referenced:* Dual stereo zoom cameras (28–100 mm equivalent focal length), 11-position narrowband filter wheels, direct tau solar filter.

---

## 6. AUTONOMOUS NAVIGATION & STATE ESTIMATION

17. **Matthies, L., et al.** (2007). "Computer Vision on Mars." *International Journal of Computer Vision*, 75(1), 67–92.  
    - *Data referenced:* Slip-induced dead-reckoning odometry drift, strapdown IMU noise modeling, Navcam stereo Visual Odometry (VO) feature tracking and uncertainty ellipse collapse.
18. **NASA Planetary Data System (PDS) & NAIF SPICE.** (2021). *Mars 2020 Perseverance Traverse Kernels (Sols 38–44)*. NASA Navigation and Ancillary Information Facility.  
    - *Data referenced:* Real ground traverse spline from Octavia E. Butler Landing site towards Kodiak Butte remnant across Jezero Crater floor.
