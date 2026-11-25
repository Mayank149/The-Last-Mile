# THE LAST MILE

**AI-Assisted Emergency Response Intelligence & Resource Allocation Prototype**

> **IMPORTANT DISCLAIMER (SYNTHETIC DEMO):**
> All emergency reports, rescue teams, shelters, and road disruptions in this prototype are **synthetic and simulated** for hackathon decision-support demonstration. The road network geometry is extracted from OpenStreetMap (`© OpenStreetMap contributors`, ODbL) for a bounded area in **Koramangala & Ejipura, Bengaluru, India**. This prototype must **not** be used for real emergency operations.

---

## 1. Architecture (Modular Monolith)

- **Frontend (`frontend/`)**: React + TypeScript + Vite + Leaflet (`OpenStreetMap` tiles with attribution).
- **Backend (`backend/`)**: Python + FastAPI modular monolith with isolated domain modules:
  - `app/modules/geospatial.py`: Loads the prepared OSMnx road network (`1766` nodes, `4449` edges) into a NetworkX `MultiDiGraph` / `DiGraph`.
  - `app/modules/simulation.py`: Applies road closures (`blocked`) and flood degradations (`degraded`, `3.0x` travel-time multiplier), and computes shortest paths vs baseline.
  - `app/modules/incidents.py`: Extracts structured incident fields from unstructured text using **Gemini API** (`GEMINI_API_KEY`) with strict Pydantic JSON validation and **deterministic local fallback**. Never invents coordinates; unverified locations remain `unverified_location` until operator confirmation.
  - `app/modules/coverage.py`: Scores predefined geographic zones for potential response gaps using:
    - `0.35 × coverage_deficit` + `0.30 × accessibility_deficit` + `0.20 × reporting_uncertainty` + `0.15 × resource_deficit`
    - Sparse reporting is treated as **information uncertainty**, never as proof of unmet demand or victim counts.
  - `app/modules/allocation.py`: Uses **Google OR-Tools** (`SCIP`/`CBC` MILP) to recommend team-to-incident assignments under availability, capability, and capacity constraints, compared against a greedy nearest-eligible-team baseline. Requires human coordinator review; no autonomous dispatch.

---

## 2. Local Setup & Run Instructions

### Prerequisites
- Python 3.12+
- Node.js 20+ and npm

### 1. Backend
```powershell
pip install -r backend\requirements.txt
# Optional: copy backend\.env.example to backend\.env and add GEMINI_API_KEY
# (If omitted, deterministic local fallback extraction is used automatically.)
cd backend
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend
```powershell
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Re-extract OSM Road Network (Optional — Preloaded JSON Included)
```powershell
python backend\scripts\extract_osm.py
```

---

## 3. Running Tests
```powershell
python -m pytest -p no:anyio -p no:langsmith backend/tests -v
```
Frontend production build check:
```powershell
cd frontend
npm run build
```

---

## 4. Declared Assumptions & Limitations
- **Real vs Synthetic Data**: Base road geometry and road classes come from OpenStreetMap; all incidents, rescue teams, shelters, zone reporting counts, and road disruptions are synthetic.
- **Modelled Travel Times**: Travel times are planning estimates derived from OSM edge lengths and documented assumed speeds by road class (`ASSUMED_SPEED_KMH` in `backend/app/config.py`), **not** live traffic or live flood-depth data.
- **Human-in-the-Loop**: AI-extracted locations are never auto-geocoded or fabricated; operators must verify/pin locations on the map, and resource-allocation outputs are recommendations requiring human approval.
