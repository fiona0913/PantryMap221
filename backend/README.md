# Pantry Map Backend API

Backend server for the Connected Micro Pantry Platform.

## Setup

1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Set up environment:**
```bash
cp .env.example .env
# Edit .env if needed
```

3. **Migrate data:**
```bash
npm run migrate
```
This will import all pantries from `../frontend/pantries.json` into the SQLite database.

4. **Start server:**
```bash
npm start
# or for development with auto-reload:
npm run dev
```

Server will run on `http://localhost:5000`

## API Endpoints

### Pantries

- `GET /api/pantries` - Get all pantries
  - Query params: `status`, `type`, `bounds` (minLat,maxLat,minLng,maxLng)
- `GET /api/pantries/:id` - Get single pantry
- `POST /api/pantries` - Create new pantry
- `PUT /api/pantries/:id` - Update pantry
- `PUT /api/pantries/:id/inventory` - Update inventory
- `PUT /api/pantries/:id/sensors` - Update sensor data

### Messages

- `GET /api/messages/:pantryId` - Get messages for a pantry
- `POST /api/messages` - Create new message

### Health

- `GET /api/health` - Health check

## Database Schema

- **pantries** - Main pantry information
- **inventory** - Inventory categories and quantities
- **sensors** - IoT sensor data (weight, door events, etc.)
- **stats** - Statistics and analytics
- **wishlist** - Wishlist items
- **messages** - Community messages/reviews

## Development

Uses SQLite for local development. For production, consider PostgreSQL or MySQL.


