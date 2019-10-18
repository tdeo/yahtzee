'use strict';

// https://blog.logrocket.com/websockets-tutorial-how-to-go-real-time-with-node-and-react-8e4693fbf843/

const PORT = process.env.PORT || 8000;
const webSocketServer = require('websocket').server;

const http = require('http');

// Spinning the http server and the websocket server.
const server = http.createServer();
server.listen(PORT);

const wsServer = new webSocketServer({
  httpServer: server
});

let clients = {};

const newGame = () => ({
  chat: [],
  players: [],
  currentRoll: [],
  currentPlayer: null,
});
var game = newGame();

function rand() {
  return 1 + Math.floor(6 * Math.random());
}

function nextPlayer() {
  let min = 100;
  let r = null;
  for (let i = 0; i < game.players.length; i++) {
    let p = game.players[i]

    if (Object.keys(p.score).length >= 14) {
      continue;
    }

    let c = Object.keys(p.score).length
    if (c < min) {
      min = c;
      r = p.id || null;
    }
  }
  return r;
}

function broadcast() {
  if (!game.currentPlayer || !clients[game.currentPlayer]) {
    game.currentRoll = []
    game.currentPlayer = nextPlayer();
  }

  for (let i = 0; i < game.players.length; i++) {
    let p = game.players[i];
    if (!(p.id) in clients) {
      delete p.id;
    }
  }

  console.log(game);

  for (let userID in clients) {
    let idx = game.players.findIndex(e => e.id === userID);
    let payload = { ...game };
    if (idx !== -1) {
      payload.me = userID;
    }
    clients[userID].send(JSON.stringify(payload));
  }
}

function processMessage(payload, userID) {
  let playerIdx = game.players.findIndex(e => e.id === userID);
  let player = game.players[playerIdx];

  if (payload.type === 'reset') {
    game = newGame();
  } else if (payload.type === 'postMessage') {
    game.chat.push({
      message: payload.message,
      playerName:  player.name,
      timestamp: Date.now(),
    });
  } else if (payload.type === 'player') {
    game.players[payload.idx].id = userID;
  } else if (payload.type === 'newPlayer') {
    game.players.push({ name: payload.name, id: userID, score: {} });
  } else if (payload.type === 'score') {
    player.score[payload.cat] = {
      score: payload.score,
      rolls: game.currentRoll,
    };
    player.lastTurn = payload.cat
    game.currentRoll = []
    game.currentPlayer = nextPlayer();
  } else if (payload.type === 'roll') {
    let newRoll = []
    for (let i = 0; i < 5; i++) {
      let prevRoll = game.currentRoll[game.currentRoll.length - 1];
      if (prevRoll) {
        prevRoll[i].blocked = payload.blocked[i];
      }
      if (payload.blocked[i]) {
        newRoll[i] = {
          value: game.currentRoll[game.currentRoll.length - 1][i].value,
        };
      } else {
        newRoll[i] = {
          value: rand(),
        };
      }
    }
    game.currentRoll.push(newRoll);
  }
  broadcast();
}

// This code generates unique userid for everyuser.
const getUniqueID = () => {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return s4() + s4() + '-' + s4();
};

wsServer.on('request', function(request) {
  const userID = getUniqueID();

  const connection = request.accept(null, request.origin);
  clients[userID] = connection;
  console.log('Client ' + userID + ' connected')

  broadcast();
  connection.send(JSON.stringify(game));

  connection.on('message', (message) => {
    let payload = JSON.parse(message.utf8Data);
    processMessage(payload, userID);
  });

  connection.on('close', () => {
    let idx = game.players.findIndex(e => e.id === userID);
    delete clients[userID];
    if (idx !== -1) {
      delete game.players[idx].id;
    }
  })
});
