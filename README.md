## Collaborative Drawing Canvas

A real-time collaborative drawing application where multiple users can draw on the same canvas simultaneously. The canvas updates live as users draw, with support for freehand drawing, shapes, undo/redo, and multiple rooms.

This project focuses on raw Canvas API usage and real-time synchronization using WebSockets (Socket.IO).

# Setup Instructions

Prerequisites:
Make sure you have the following installed:
- Node.js
- npm

## STEPS TO RUN THE PROJECT 

# Step 1: Install Dependencies
From the project root directory, run: 
npm install

# Step 2: Start the Server
Run:
npm start

You should see a message like:
Server running on port 3000

# Step 3: Open the App in Browser
Open your browser and go to: http://localhost:3000
The drawing canvas will load in the browser.

## How to Test with Multiple Users
# Option 1: Same Computer
-Open the app in two different browser windows
-OR open one normal window and one incognito window
Drawing in one window should instantly appear in the other.

# Option 2: Multiple Devices (Phone / Laptop)
1. Make sure all devices are on the same Wi-Fi network
2. Find your computer’s local IP address
   Example: 192.168.1.5
3. On other devices, open:
  http://192.168.1.5:3000
  
  All connected devices will draw on the same canvas in real time.

  ## Features

- Smooth freehand drawing using quadratic curve smoothing
- Eraser tool
- Shape tools:
  - Line
  - Rectangle
  - Circle
  - Triangle
- Live cursor movement indicators
- Global undo and redo across all users
- URL-based rooms for separate canvases
- Responsive fullscreen canvas

## Known Limitations / Bugs

- No user authentication (anyone with the link can join)
- Drawing state is stored in memory and resets if the server restarts
- No selection or editing of existing shapes
- Performance may degrade with a very large number of users in one room

These limitations were intentional to keep the core real-time drawing logic simple and clear.

## Time Spent on the Project

Approximately 4–5 days, including:
- Designing the real-time data flow
- Implementing smooth canvas drawing
- Handling undo/redo across multiple users
- Fixing live drawing vs redraw edge cases
- UI polish and deployment setup

## Deployment

The application is deployed as a single Node.js service where:
- Frontend files are served by Express
- Socket.IO runs on the same server
This ensures WebSocket connections work reliably in production.
LINK:- https://flam-canvas-m6xa.onrender.com/