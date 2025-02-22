const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const upload = multer({ dest: 'uploads/' });

// Game state
const sessionId = uuidv4();
const players = new Map();
const votes = new Map();

// Randomly created user names
const adjectives = ['Genius-Level', 'Chronically-Confused', 'Overcaffeinated', 'Diet', 'Unexpectedly-Flexible', 'Barely-Functional', 'Quantum-Level', 'Recklessly-Optimistic', 'fent-leaning', 'Suspiciously-Motivated', 'Ironically-Unemployed', 'Legally-Blind', 'Aggressively-Mediocre', 'Outrageously-Underwhelming', 'Glitch-in-the-Matrix', 'Hyper-Realistic', 'Artificially-Flavored', 'Emotionally-Biodegradable', 'Government-Approved', 'Reverse-Engineered'];
  const animals = ['Waffle-Sculptor', 'Meme-Curator', 'Cat-Negotiator', 'Shower-Philosopher', 'Burrito-Enthusiast', 'Procrastination-Coach', 'TikTok-Historian', 'Existential-Babysitter', 'Budget-Wizard', 'Semi-Retired-Villain', 'Overqualified-Barista', 'Aspiring-Ninja', 'Office-Goblin', 'WiFi-Prophet', 'Emotional-Support-Human', 'Freelance-Time-Traveler', 'Unlicensed-Therapist', 'Accidental-Criminal', 'Parallel-Universe-Explorer', 'Professional-Food-Stealer', 'Conspiracy-Theory-Tester', 'Gluten-Free-Warrior', 'Aspiring-Background-Character', 'Socially-Distanced-Overlord', 'Crypto-Intern'];
function generateAnimalName() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    return `${adj} ${animal}`;
}

// Serve static files
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));

// Host page with QR code
app.get('/', async (req, res) => {
    const host = 'localhost';
    const port = 3000;
    const url = `http://${host}:${port}/game/${sessionId}`;
    console.log(`[HOST] Serving QR code URL: ${url}`);
    try {
        const qrCode = await qrcode.toDataURL(url);
        res.send(`
            <h1>Meme Time!</h1>
            <p>Scan to join:</p>
            <img src="${qrCode}" alt="Scan to join"/>
            <div id="player-list"></div>
            <button id="start-slideshow">Start Game!</button>
            <div id="leaderboard"></div>
            <div id="slideshow"></div>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    margin: 0;
                    padding: 20px;
                    background-color: #f0f0f0;
                }
                h1 {
                    color: #333;
                    margin-bottom: 10px;
                }
                #player-list {
                    margin: 20px 0;
                    padding: 10px;
                    background-color: #fff;
                    border-radius: 5px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                #player-list p {
                    margin: 5px 0;
                }
                #start-slideshow {
                    padding: 10px 20px;
                    font-size: 16px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                }
                #start-slideshow:hover {
                    background-color: #45a049;
                }
                #slideshow {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background-color: rgba(255, 255, 255, 0.9);
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                    max-width: 90%;
                    max-height: 90vh;
                    overflow: hidden;
                }
                #slideshow img {
                    max-width: 100%;
                    max-height: 70vh; /* Leave room for text */
                    object-fit: contain;
                    border-radius: 5px;
                }
                #slideshow p {
                    margin-top: 10px;
                    font-size: 18px;
                    color: #333;
                }
                #leaderboard {
                    margin-top: 20px;
                    padding: 10px;
                    background-color: #fff;
                    border-radius: 5px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
            </style>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                socket.on('connect', () => {
                    socket.emit('setHost');
                });
                socket.on('uploadUpdate', (players) => {
                    const playerList = document.getElementById('player-list');
                    const nonHostPlayers = players.filter(p => !p.isHost);
                    playerList.innerHTML = '<h2>Players:</h2>' + nonHostPlayers.map(p => 
                        \`<p>\${p.animalName} - \${p.memePath ? 'Uploaded' : 'Pending'}</p>\`
                    ).join('');
                });
                document.getElementById('start-slideshow').addEventListener('click', () => {
                    socket.emit('startSlideshow');
                });
                socket.on('slideshow', (memes) => {
                    let index = 0;
                    const slideshow = document.getElementById('slideshow');
                    function nextMeme() {
                        if (index >= memes.length) {
                            socket.emit('startVoting');
                            slideshow.innerHTML = '<h2>Voting Time!</h2>';
                            return;
                        }
                        const imagePath = '/uploads/' + memes[index].memePath.split('\\\\').pop().split('/').pop();
                        console.log('[DEBUG] Loading image: ' + imagePath);
                        slideshow.innerHTML = \`<img src="\${imagePath}"><p>\${memes[index].animalName}</p>\`;
                        index++;
                        setTimeout(nextMeme, 5000);
                    }
                    nextMeme();
                });
                socket.on('results', (ranked) => {
                    const leaderboard = document.getElementById('leaderboard');
                    leaderboard.innerHTML = '<h2>Leaderboard:</h2>' + ranked.map(([name, score]) => 
                        \`<p>\${name}: \${score} votes</p>\`
                    ).join('');
                });
            </script>
        `);
    } catch (err) {
        console.error('[HOST] QR code generation failed:', err);
        res.status(500).send('QR code generation failed');
    }
});

// Player page
app.get('/game/:sessionId', (req, res) => {
    const requestedSession = req.params.sessionId;
    console.log(`[PLAYER] Request for session: ${requestedSession}`);
    if (requestedSession === sessionId) {
        res.sendFile(path.join(__dirname, 'public', 'player.html'));
    } else {
        res.status(404).send('Invalid session');
    }
});

// Handle meme upload
app.post('/upload', upload.single('meme'), (req, res) => {
    console.log(`[UPLOAD] From socketId: ${req.body.socketId}`);
    const player = players.get(req.body.socketId);
    if (player) {
        player.memePath = req.file.path;
        console.log(`[UPLOAD] Saved memePath: ${player.memePath}`);
        io.emit('uploadUpdate', Array.from(players.values()));
        res.sendStatus(200);
    } else {
        res.status(400).send('Player not found');
    }
});

// WebSocket connection
io.on('connection', (socket) => {
    console.log(`[SOCKET] New connection: ${socket.id}`);
    const animalName = generateAnimalName();
    players.set(socket.id, { animalName, memePath: null, isHost: false });
    socket.emit('animalName', animalName);
    io.emit('uploadUpdate', Array.from(players.values()));

    socket.on('setHost', () => {
        console.log(`[SOCKET] Marking ${socket.id} as host`);
        const player = players.get(socket.id);
        if (player) player.isHost = true;
        io.emit('uploadUpdate', Array.from(players.values()));
    });

    socket.on('startSlideshow', () => {
        const memes = Array.from(players.values()).filter(p => p.memePath);
        console.log('[SLIDESHOW] Starting with', memes.length, 'memes');
        io.emit('slideshow', memes);
    });

    socket.on('startVoting', () => {
        const memes = Array.from(players.values()).filter(p => p.memePath);
        console.log('[VOTING] Broadcasting voting options to all players');
        io.emit('voting', memes);
    });

    socket.on('submitVote', (vote) => {
        votes.set(socket.id, vote);
        console.log(`[VOTE] ${socket.id} voted for ${vote}`);
        const activePlayers = Array.from(players.values()).filter(p => p.memePath).length;
        console.log(`[VOTE DEBUG] Votes: ${votes.size}, Active Players: ${activePlayers}`);
        if (votes.size === activePlayers) {
            const tally = {};
            votes.forEach(v => tally[v] = (tally[v] || 0) + 1);
            const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
            console.log('[VOTE] Emitting results:', ranked);
            io.emit('results', ranked);
            cleanup();
        }
    });

    socket.on('disconnect', () => {
        console.log(`[SOCKET] Disconnected: ${socket.id}`);
        players.delete(socket.id);
        io.emit('uploadUpdate', Array.from(players.values()));
    });
});

function cleanup() {
    players.forEach(p => p.memePath && fs.unlinkSync(p.memePath));
    players.clear();
    votes.clear();
    console.log('[CLEANUP] Session reset');
}

const port = 3000;
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});