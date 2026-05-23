<div align="center">
  <img src="https://img.shields.io/badge/GPS-Tracker-blue?style=for-the-badge&logo=map&logoColor=white" alt="GPS Tracker Logo"/>
  <h1>🌍 GPS Fleet Tracker & Management System</h1>
  <p><strong>Enterprise-Grade Vehicle Telemetry & Live Tracking Platform</strong></p>

  <p>
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#installation">Installation</a> •
    <a href="#environment-variables">Environment Variables</a> •
    <a href="#deployment">Deployment</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
    <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
    <img src="https://img.shields.io/badge/Tailwind-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  </p>
</div>

---

## 🚀 Overview

A comprehensive, full-stack GPS fleet management and tracking solution designed for scalability and high performance. The platform allows businesses to monitor their vehicles in real-time, view historical routes, manage drivers and hardware GPS devices, and receive instant alerts for geofence breaches or emergency events.

## ✨ Key Features

- **📍 Real-Time Tracking**: Live vehicle telemetry powered by WebSockets (Socket.io).
- **🗺️ Interactive Maps**: Highly customizable map interfaces supporting multiple layers (Satellite, Street, Terrain).
- **🕰️ Professional History Playback**: Interactive timeline to replay vehicle routes frame-by-frame with variable speeds.
- **📱 TCP Hardware Support**: Built-in TCP AIS server to receive live data directly from physical GPS hardware devices.
- **🏢 Multi-Tenancy**: Support for Organizations, Superadmins, Admins, and standard Users.
- **🚧 Geofencing & Alerts**: Draw custom polygon/circular boundaries and trigger real-time notifications on entry/exit.
- **📊 Analytics & Heatmaps**: Driving behavior insights, daily statistics, and calendar heatmaps.

## 💻 Tech Stack

### Frontend (`/client`)
- **Framework**: Next.js (App Router), React
- **Styling**: Tailwind CSS, Lucide Icons
- **State Management**: Redux Toolkit
- **Mapping**: React Leaflet, Turf.js
- **Data Visualization**: Recharts, Embla Carousel

### Backend (`/server`)
- **Runtime**: Node.js, Express.js
- **Database**: MongoDB (Mongoose), Redis (Caching)
- **Real-time**: Socket.io (Client facing), Raw TCP (Hardware facing)
- **Authentication**: JWT, bcryptjs

---

## 🏗️ Architecture

This repository is structured as a monorepo for easier management:

```
gps-fleet-tracker/
├── client/                 # Next.js Frontend Application
│   ├── app/                # Next.js App Router Pages
│   ├── components/         # Reusable UI Components
│   └── ...
├── server/                 # Node.js Express Backend & TCP Server
│   ├── Modules/            # Domain-driven feature modules (Users, Vehicles, etc.)
│   ├── scripts/            # Admin / Seeding scripts
│   └── tcp/                # TCP Server for hardware GPS ingestion
├── render.yaml             # Render deployment blueprint for the Backend
└── README.md
```

---

## 🛠️ Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v18+)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)
- [Redis](https://redis.io/)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/gps-fleet-tracker.git
cd gps-fleet-tracker
```

### 2. Setup the Backend
```bash
cd server
npm install
```
Start the development server:
```bash
npm run dev
```
*(The backend will start on port `5000` and the TCP server on port `6000`)*

### 3. Setup the Frontend
```bash
cd ../client
npm install
```
Start the frontend Next.js server:
```bash
npm run dev
```
*(The frontend will start on port `3000`)*

---

## 🔐 Environment Variables

You need to set up `.env` files for both the client and server. 

### `server/.env`
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/gps_tracking
JWT_SECRET=your_super_secret_jwt_key
REDIS_URL=redis://127.0.0.1:6379
```

### `client/.env`
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

## 🚀 Deployment

The project is pre-configured for modern hosting platforms.

### Frontend (Vercel)
The `client` directory is fully configured for Vercel. 
1. Import the repository into Vercel.
2. Set the **Root Directory** to `client`.
3. Add the required Environment Variables.

### Backend (Render)
The root directory includes a `render.yaml` Blueprint.
1. Connect the repository to Render.
2. Render will automatically detect the blueprint and provision the Node.js backend.
3. Update your Database & JWT secrets in the Render dashboard.

---

<div align="center">
  <p>Built with ❤️ for Modern Fleet Management</p>
</div>
