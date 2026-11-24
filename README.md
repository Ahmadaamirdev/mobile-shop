# Unity Mobile - Shop Management Web App (Monorepo)

A simple, clean, and professional shop management web app built for **Unity Mobile** (Shop #14, Rehma Center, Kachery Road, Multan).

---

## 📁 Monorepo Structure

```text
Mobile shop/
├── backend/
│   ├── config/             # Database connection & DNS fallbacks
│   ├── controllers/        # Purchase, Sale, Inventory, and Invoice business logic
│   ├── middleware/         # Global error handling and validation
│   ├── models/             # Mongoose schemas (Purchase, Sale, Inventory, Invoice)
│   ├── routes/             # RESTful API route definitions
│   ├── .env                # Atlas connection credentials & port
│   ├── server.js           # Express app setup and server entry point
│   └── package.json
│
├── frontend/
│   ├── public/             # Static assets including Unity Mobile logo
│   ├── src/
│   │   ├── components/     # Header, Purchases, Sales, Inventory, and Invoice components
│   │   ├── services/       # Axios API client
│   │   ├── App.jsx         # Main application layout and state
│   │   └── index.css       # Clean, neutral stylesheet & centered A4 print layout
│   ├── vite.config.js      # Vite build config & proxy to backend
│   └── package.json
│
├── package.json            # Monorepo root package with unified scripts
└── README.md
```

---

## 🚀 Running the App

From the root directory:

```bash
npm run dev
```

This single command automatically starts **both** services concurrently:
- **Backend**: `http://localhost:5000` (watches for code changes & connects to MongoDB Atlas)
- **Frontend**: `http://localhost:3000` (Vite dev server with hot reload and API proxy)

---

## 🛠 Additional Commands

- `npm run dev:backend` — Start only the backend in watch mode
- `npm run dev:frontend` — Start only the frontend Vite dev server
- `npm run build` — Build the frontend for production
- `npm start` — Start the production backend server
