# Home Bus Routes Display

A React application that displays real-time bus arrival information for KMB (Kowloon Motor Bus) routes in Hong Kong.

## Routes Displayed

- **77K** Yuen Long - Sheung Shui
- **77K** Sheung Shui - Yuen Long
- **54** Sheung Tsuen - Yuen Long
- **251B** Sheung Tsuen - Pat Heung Road

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure your routes (optional):
   - Edit `src/routes.json` to add, remove, or modify routes
   - Each route requires: `route`, `stop_id`, `service_type`, `direction`, `stopName`, `destination`, `routeName`, and `id`
   - The default stop is "Wang Toi Shan"

### Running the Application

Start the React app:
```bash
npm start
```

The React app will be available at `http://localhost:3000`

## Configuration

To change the bus stop or add/remove routes, edit `src/routes.json`:

```json
[
  {
    "route": "77K",
    "stop_id": "E125CB2691C02A61",
    "service_type": 1,
    "direction": "O",
    "stopName": "Wang Toi Shan",
    "destination": "Sheung Shui",
    "routeName": "77K Yuen Long - Sheung Shui",
    "id": 1
  }
]
```

## Data Source

This application uses the [KMB Open Data API](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb) provided by the Hong Kong Transport Department.
