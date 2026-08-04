import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Room from './pages/Room';
import './index.css';

// Connect to the server
const serverUrl = import.meta.env.PROD ? undefined : 'http://localhost:3001';
const socket = io(serverUrl);

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home socket={socket} />} />
        <Route path="/join/:roomCode" element={<Home socket={socket} />} />
        <Route path="/room/:roomCode" element={<Room socket={socket} />} />
      </Routes>
    </Router>
  );
}

export default App;
