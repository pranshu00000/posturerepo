# 🧍‍♂️ Real-Time Posture Detection App

A real-time AI posture detection tool to evaluate:
- 🏋️ Squat form (knees + back alignment)
- 🪑 Desk sitting posture (neck + spine)

This app uses **TensorFlow.js** MoveNet model for pose estimation and sends pose keypoints to a **Node.js backend** via **Socket.IO**, which evaluates posture using custom rule-based logic.

---

## 🛠️ Tech Stack Used

### 🔹 Frontend (`posture-frontend`)
- React (Vite)
- Tailwind CSS
- Heroicons
- TensorFlow.js + MoveNet
- react-webcam

### 🔹 Backend (`posture-backend`)
- Node.js
- Express
- Socket.IO
- Rule-based posture evaluation engine

---

## 🚀 Live Demo

- 🔗 **Deployed App**: [https://posturerepo.vercel.app](https://posturerepo.vercel.app)

---

## 📦 Setup Instructions (Run Locally)

### ✅ Prerequisites
- Node.js installed
- npm or yarn

---

### 1️⃣ Clone the Repository

bash
git clone https://github.com/pranshu00000/posturerepo.git
cd posturerepo

### install & run backend
- cd posture-backend
- npm install
- node server.js

### install and run frontend
- cd ../posture-frontend
- npm install
- npm run dev

### Project structure
posturerepo/
├── posture-frontend/   # React + TensorFlow.js frontend
├── posture-backend/    # Express + Socket.IO backend
└── README.md
