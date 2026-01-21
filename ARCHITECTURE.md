# Architecture – Collaborative Drawing Canvas

This document explains how the collaborative drawing canvas works internally.  
The focus is on how drawing data flows, how real-time synchronization is handled, and why certain design decisions were made.

---

## 1. Data Flow Diagram (Text Explanation)

The drawing flow follows a simple and predictable path:

1. A user interacts with the canvas using mouse or touch input.
2. Pointer events are captured in the browser.
3. While the user is drawing:
   - The stroke is rendered locally for immediate visual feedback.
   - No full canvas redraw happens during this phase.
4. When the user finishes drawing:
   - The completed stroke or shape is sent to the server.
5. The server updates the shared drawing state for the room.
6. The updated state is broadcast to all connected users.
7. Each client redraws the canvas using the shared state.

This approach keeps the UI responsive while ensuring all users stay synchronized.

---

## 2. WebSocket Protocol

The application uses Socket.IO for real-time communication.

### Client → Server Events

- **`stroke:commit`**
  - Sent when a user finishes drawing a stroke or shape.
  - Contains:
    - tool type (brush, eraser, shape)
    - stroke points or shape coordinates
    - color and stroke width
    - unique stroke ID

- **`undo`**
  - Requests a global undo operation.

- **`redo`**
  - Requests a global redo operation.

- **`cursor:move`**
  - Sends the user’s cursor position so other users can see where they are drawing.

---

### Server → Client Events

- **`state:update`**
  - Sends the full list of drawing operations for the room.
  - Triggered after:
    - a new stroke is committed
    - undo or redo is performed
    - a user joins a room

- **`cursor:update`**
  - Broadcasts cursor positions of connected users.

---

## 3. Undo / Redo Strategy

Undo and redo are handled **globally on the server**, not per user.

- The server maintains an ordered list of drawing operations.
- Each operation has an `active` flag.
- Undo:
  - Finds the most recent active operation.
  - Marks it as inactive.
- Redo:
  - Reactivates the most recently undone operation.

After each undo or redo:
- The server sends the updated state to all clients.
- Clients fully redraw the canvas from this state.

This ensures every user sees the same result and avoids desynchronization.

---

## 4. Performance Decisions

Several important performance decisions were made during development:

### Live Drawing vs Redraw
- While a user is actively drawing, strokes are rendered directly to the canvas.
- The canvas is **not cleared or redrawn** during live drawing.
- Full redraws only occur on:
  - stroke commit
  - undo / redo
  - window resize
  - state updates from the server

This avoids flickering and keeps drawing smooth.

---

### Stroke Smoothing
- Freehand strokes use quadratic curve interpolation.
- This prevents jagged lines, especially on large canvases.
- The same smoothing logic is used for both live drawing and final redraws to keep visuals consistent.

---

### Minimal State on Client
- The client does not try to resolve conflicts or reorder strokes.
- It simply renders the state received from the server.
- This keeps the client logic simpler and easier to reason about.

---

## 5. Conflict Resolution

The application uses a **design-based conflict resolution strategy** rather than complex locking.

- Each completed stroke is treated as an atomic operation.
- The server processes strokes in the order they are received.
- Overlapping drawings are allowed.
- No attempt is made to merge or modify strokes from different users.

Because drawing is additive by nature, this approach works well and avoids unnecessary complexity.

---

## Summary

The architecture prioritizes:
- Real-time responsiveness
- Predictable state synchronization
- Simplicity over over-engineering
- Clear separation between live drawing and shared state

This design made it easier to debug complex canvas issues while keeping the system reliable and easy to extend.
