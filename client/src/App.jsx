import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import Home from './pages/Home';
import Room from './pages/Room';
import './index.css';

// Connect to the server
const serverUrl = import.meta.env.PROD ? undefined : 'http://localhost:3001';
const socket = io(serverUrl);

function App() {
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
