import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPersistentId } from '../utils/persistentId';

export default function Home({ socket }) {
  const { roomCode: urlRoomCode } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState(localStorage.getItem('rummi-name') || '');
  const [roomCode, setRoomCode] = useState(urlRoomCode || '');
  const [avatar, setAvatar] = useState(localStorage.getItem('rummi-avatar') || '🦊');

  const saveName = (n) => { setName(n); localStorage.setItem('rummi-name', n); };
  const saveAvatar = (a) => { setAvatar(a); localStorage.setItem('rummi-avatar', a); };

  const handleCreate = () => {
    if (!name) return alert('Please enter a name');
    socket.emit('createRoom', { name, avatar, persistentId: getPersistentId() }, (response) => {
      if (response.success) {
        navigate(`/room/${response.roomCode}`);
      }
    });
  };

  const handleJoin = () => {
    if (!name) return alert('Please enter a name');
    if (!roomCode) return alert('Please enter a room code');
    socket.emit('joinRoom', { roomCode: roomCode.toUpperCase(), name, avatar, persistentId: getPersistentId() }, (response) => {
      if (response.success) {
        navigate(`/room/${roomCode.toUpperCase()}`);
      } else {
        alert(response.message || 'Error joining room');
      }
    });
  };

  return (
    <div className="lobby-container">
      <div className="lobby-card glass">
        <h1 style={{ textAlign: 'center', margin: 0, fontSize: '2.5rem' }}>Rummikub</h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label>Your Name</label>
          <input 
            type="text" 
            placeholder="Enter your name..." 
            value={name} 
            onChange={e => saveName(e.target.value)} 
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label>Avatar</label>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '2rem' }}>
            {['🦊', '🐼', '🐯', '🐸', '🦄'].map(emoji => (
              <div 
                key={emoji}
                onClick={() => saveAvatar(emoji)}
                style={{
                  cursor: 'pointer',
                  padding: '0.5rem',
                  border: avatar === emoji ? '2px solid var(--primary)' : '2px solid transparent',
                  borderRadius: '12px',
                  background: avatar === emoji ? 'var(--surface)' : 'transparent'
                }}
              >
                {emoji}
              </div>
            ))}
          </div>
        </div>

        {urlRoomCode ? (
          <button onClick={handleJoin} style={{ marginTop: '1rem' }}>
            Join Room {urlRoomCode.toUpperCase()}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={handleCreate}>Create New Game</button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="Room Code" 
                value={roomCode} 
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                style={{ flex: 1 }}
                maxLength={4}
              />
              <button onClick={handleJoin} style={{ background: 'var(--surface-border)' }}>Join</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
