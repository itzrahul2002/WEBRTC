// Import necessary modules
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express(); // Initialize the Express application
const server = http.createServer(app); // Create an HTTP server using the Express app
const io = new Server(server, {
  cors: {
    origin: '*', // Allow requests from any origin (CORS policy)
    methods: ['GET', 'POST'] // Allow GET and POST methods
  }
});

// Handle new socket connections
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id); // Log the ID of the connected user

  // Relay signaling data (e.g., offers, answers, ICE candidates) between clients
  socket.on('signal', (data) => {
    const { to, from, signal } = data;
    io.to(to).emit('signal', { from, signal }); // Send the signal to the intended recipient
  });

  // Handle a user joining a room
  socket.on('join-room', (roomId) => {
    socket.join(roomId); // Add the user to the specified room
    io.to(roomId).emit('user-joined', socket.id); // Notify other users in the room that a new user has joined
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id); // Log the disconnection
  });
});

// Start the server and listen on port 5000
server.listen(5000, () => {
  console.log('Socket.io server is running on port 5000');
});
