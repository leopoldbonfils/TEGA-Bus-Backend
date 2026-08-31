# 🚌 TEGA Bus Backend

Production-ready Node.js + TypeScript backend for the **TEGA Bus** public transportation system — supporting Passenger, Driver, and Admin roles with real-time GPS tracking via Socket.IO.

---

## 📋 Features

- ✅ JWT Authentication with role-based access control (PASSENGER / DRIVER / ADMIN)
- ✅ Full CRUD: Users, Buses, Drivers, Routes, Bus Stops, Trips
- ✅ Real-time GPS tracking via Socket.IO
- ✅ Fake GPS simulator for MVP demos (no hardware needed)
- ✅ ETA calculation and next-stop tracking
- ✅ Admin dashboard statistics
- ✅ Route search by origin/destination
- ✅ PostgreSQL + Prisma ORM
- ✅ Zod validation on all endpoints
- ✅ Centralized error handling
- ✅ TypeScript throughout
- ✅ Integration test suite

---

## 🛠 Tech Stack

| Layer         | Technology           |
|---------------|----------------------|
| Runtime       | Node.js              |
| Language      | TypeScript           |
| Framework     | Express.js v4        |
| Database      | PostgreSQL           |
| ORM           | Prisma               |
| Real-time     | Socket.IO            |
| Auth          | JWT + bcrypt         |
| Validation    | Zod                  |
| Security      | Helmet, CORS         |
| Logging       | Morgan               |
| Testing       | Jest + Supertest     |

---

## ⚙️ Requirements

- Node.js >= 18
- npm >= 9
- PostgreSQL >= 14

---

## 🚀 Installation

```bash
# 1. Clone/navigate into the project
cd tega-bus-backend

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env and set your DATABASE_URL and JWT_SECRET
```

---

## 🔐 Environment Variables

| Variable            | Description                              | Default                    |
|---------------------|------------------------------------------|----------------------------|
| `PORT`              | HTTP server port                         | `5000`                     |
| `DATABASE_URL`      | PostgreSQL connection string             | **Required**               |
| `JWT_SECRET`        | Secret key for JWT signing               | **Required (min 16 chars)**|
| `JWT_EXPIRES_IN`    | JWT expiration (e.g., `7d`, `24h`)       | `7d`                       |
| `FAKE_GPS_INTERVAL` | GPS simulation tick in milliseconds      | `5000`                     |
| `CLIENT_URL`        | Allowed CORS origin                      | `http://localhost:3000`    |
| `NODE_ENV`          | Environment (`development`/`production`) | `development`              |

Example `DATABASE_URL`:
```
postgresql://postgres:password@localhost:5432/tegabus_db
```

---

## 🗄 PostgreSQL Setup

```sql
-- Connect to PostgreSQL as superuser
CREATE DATABASE tegabus_db;
CREATE USER tegabus WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE tegabus_db TO tegabus;
```

---

## 🔧 Prisma Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations (creates all tables)
npm run prisma:migrate

# Seed the database with demo data
npm run prisma:seed
```

---

## 🌱 Demo Accounts (after seeding)

| Role       | Email                    | Password      |
|------------|--------------------------|---------------|
| ADMIN      | admin@tegabus.com        | Admin123!     |
| DRIVER 1   | driver@tegabus.com       | Driver123!    |
| DRIVER 2   | driver2@tegabus.com      | Driver123!    |
| PASSENGER  | passenger@tegabus.com    | Passenger123! |

---

## 🏃 Start Development Server

```bash
npm run dev
# Server: http://localhost:5000
# Health: http://localhost:5000/health
```

---

## 📦 Build for Production

```bash
npm run build
npm run start
```

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint              | Auth | Description           |
|--------|-----------------------|------|-----------------------|
| POST   | `/api/auth/register`  | No   | Register as passenger |
| POST   | `/api/auth/login`     | No   | Login                 |
| GET    | `/api/auth/me`        | Yes  | Get current user      |

### Buses
| Method | Endpoint                        | Roles         | Description              |
|--------|---------------------------------|---------------|--------------------------|
| GET    | `/api/buses`                    | All           | List all buses           |
| GET    | `/api/buses/active`             | All           | List active (on-trip) buses |
| GET    | `/api/buses/:id`                | All           | Get bus by ID            |
| GET    | `/api/buses/:id/location`       | All           | Get latest bus location  |
| GET    | `/api/buses/:id/location/history` | All         | Location history         |
| POST   | `/api/buses`                    | ADMIN         | Create bus               |
| PUT    | `/api/buses/:id`                | ADMIN         | Update bus               |
| DELETE | `/api/buses/:id`                | ADMIN         | Delete bus               |

### Drivers
| Method | Endpoint              | Roles          | Description                |
|--------|-----------------------|----------------|----------------------------|
| GET    | `/api/drivers`        | ADMIN          | List all drivers           |
| GET    | `/api/drivers/:id`    | ADMIN, DRIVER  | Get driver by ID           |
| GET    | `/api/drivers/me`     | DRIVER         | Get own driver profile     |
| GET    | `/api/drivers/me/trips` | DRIVER       | Get own trip history       |
| POST   | `/api/drivers`        | ADMIN          | Create driver (+ user)     |
| PUT    | `/api/drivers/:id`    | ADMIN, DRIVER  | Update driver              |

### Routes
| Method | Endpoint                             | Roles  | Description       |
|--------|--------------------------------------|--------|-------------------|
| GET    | `/api/routes`                        | All    | List all routes   |
| GET    | `/api/routes/search?from=X&to=Y`     | All    | Search routes     |
| GET    | `/api/routes/:id`                    | All    | Get route by ID   |
| POST   | `/api/routes`                        | ADMIN  | Create route      |
| PUT    | `/api/routes/:id`                    | ADMIN  | Update route      |
| DELETE | `/api/routes/:id`                    | ADMIN  | Delete route      |

### Bus Stops
| Method | Endpoint        | Roles  | Description          |
|--------|-----------------|--------|----------------------|
| GET    | `/api/stops`    | All    | List all stops       |
| GET    | `/api/stops/:id`| All    | Get stop by ID       |
| POST   | `/api/stops`    | ADMIN  | Create stop          |
| PUT    | `/api/stops/:id`| ADMIN  | Update stop          |
| DELETE | `/api/stops/:id`| ADMIN  | Delete stop          |

### Trips
| Method | Endpoint              | Roles           | Description             |
|--------|-----------------------|-----------------|-------------------------|
| GET    | `/api/trips`          | ADMIN, DRIVER   | List all trips          |
| GET    | `/api/trips/active`   | All             | List active trips       |
| GET    | `/api/trips/:id`      | ADMIN, DRIVER   | Get trip by ID          |
| POST   | `/api/trips/start`    | DRIVER          | Start a trip            |
| POST   | `/api/trips/:id/end`  | DRIVER          | End a trip              |

### Locations
| Method | Endpoint          | Roles           | Description          |
|--------|-------------------|-----------------|----------------------|
| POST   | `/api/locations`  | DRIVER, ADMIN   | Send location update |

### Admin
| Method | Endpoint                          | Roles  | Description               |
|--------|-----------------------------------|--------|---------------------------|
| GET    | `/api/admin/dashboard`            | ADMIN  | Dashboard stats           |
| GET    | `/api/admin/live-buses`           | ADMIN  | Live buses with locations |
| GET    | `/api/admin/active-trips`         | ADMIN  | Active trips              |
| GET    | `/api/admin/statistics`           | ADMIN  | Detailed stats            |
| POST   | `/api/admin/fake-gps/start/:busId`| ADMIN  | Start GPS simulation      |
| POST   | `/api/admin/fake-gps/stop/:busId` | ADMIN  | Stop GPS simulation       |
| GET    | `/api/admin/fake-gps/status/:busId` | ADMIN| Simulation status         |

---

## 🔑 Authentication

All protected routes require a `Bearer` token:

```http
Authorization: Bearer <your-jwt-token>
```

---

## 🔌 Socket.IO Events

### Client → Server

| Event         | Payload       | Description                       |
|---------------|---------------|-----------------------------------|
| `track:bus`   | `busId`       | Subscribe to a bus's location updates |
| `untrack:bus` | `busId`       | Unsubscribe from a bus            |
| `join:drivers`| —             | Join the drivers broadcast room   |

### Server → Client

| Event            | Payload                           | Description                  |
|------------------|-----------------------------------|------------------------------|
| `bus:location`   | `{busId, busNumber, lat, lon, speed, heading, timestamp}` | Real-time location |
| `trip:started`   | `{tripId, busId, routeId}`        | A trip started               |
| `trip:ended`     | `{tripId, busId, status}`         | A trip completed             |
| `track:bus:ack`  | `{busId, message}`                | Confirmation of tracking     |

---

## 🚀 Fake GPS Simulator

The fake GPS simulator lets you demonstrate live bus tracking without real hardware.

```
Admin → POST /api/admin/fake-gps/start/:busId
        ↓
Backend loads route stops
        ↓
Interpolates between stops every FAKE_GPS_INTERVAL ms
        ↓
Saves location to DB
        ↓
Socket.IO broadcasts bus:location
        ↓
Passenger app sees bus moving on map
```

The simulator automatically stops when the bus reaches the final stop, or when:
- `POST /api/admin/fake-gps/stop/:busId` is called
- The trip ends via `POST /api/trips/:id/end`

---

## 🏁 Full End-to-End Test Flow

```bash
# 1. Login as admin
POST /api/auth/login
{ "email": "admin@tegabus.com", "password": "Admin123!" }
# → save token

# 2. Start Fake GPS (bus 101 already seeded with route)
POST /api/admin/fake-gps/start/<bus-101-id>
# → GPS starts broadcasting every 5 seconds

# 3. Login as passenger
POST /api/auth/login  (passenger credentials)

# 4. Get active buses
GET /api/buses/active
# → see Bus 101 on Route 101

# 5. Connect Socket.IO client
# emit: track:bus, <bus-id>
# receive: bus:location events every 5s

# 6. Stop simulation
POST /api/admin/fake-gps/stop/<bus-id>

# OR: Login as driver, start trip, GPS auto-starts, end trip
POST /api/trips/start    (driver token)
POST /api/trips/:id/end  (driver token)
```

---

## 🧪 Running Tests

```bash
# Run all tests
npm run test

# With coverage
npm run test -- --coverage
```

> ⚠️ Tests require a live PostgreSQL connection matching `DATABASE_URL` in `.env`. Tests clean up their own data.

---

## 📁 Project Structure

```
src/
├── config/         # env validation, Prisma client
├── controllers/    # HTTP handlers
├── services/       # Business logic (auth, bus, trip, GPS...)
├── routes/         # Express router definitions
├── middleware/     # auth, roles, error, validation
├── sockets/        # Socket.IO event handlers
├── utils/          # jwt, password, response helpers
├── types/          # Shared TypeScript types
├── __tests__/      # Integration tests
├── app.ts          # Express app factory
└── server.ts       # HTTP + Socket.IO server entry
prisma/
├── schema.prisma   # DB schema
└── seed.ts         # Demo data seeder
```

---

## NPM Scripts

| Script                  | Description                          |
|-------------------------|--------------------------------------|
| `npm run dev`           | Start dev server with hot reload     |
| `npm run build`         | Compile TypeScript to `dist/`        |
| `npm run start`         | Run compiled production server       |
| `npm run test`          | Run integration tests                |
| `npm run prisma:generate` | Regenerate Prisma client           |
| `npm run prisma:migrate`  | Run DB migrations                  |
| `npm run prisma:seed`     | Seed demo data                     |
| `npm run prisma:studio`   | Open Prisma Studio (DB GUI)        |

---

*Built with ❤️ for TEGA Bus — Kigali, Rwanda*
