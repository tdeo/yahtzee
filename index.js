'use strict';

// https://blog.logrocket.com/websockets-tutorial-how-to-go-real-time-with-node-and-react-8e4693fbf843/

const webSocketsServerPort = 8000;
const webSocketServer = require('websocket').server;

const http = require('http');

// Spinning the http server and the websocket server.
const server = http.createServer();
server.listen(webSocketsServerPort);

const wsServer = new webSocketServer({
  httpServer: server
});

let clients = {};
let game = {
  players: [
    { name: 'Titi', score: {} },
    { name: 'Val', score: {} },
  ],
  currentRoll: [],
  currentPlayer: null,
};

function rand() {
  return 1 + Math.floor(6 * Math.random());
}

function nextPlayer() {
  let min = 100;
  let r = null;
  for (let i = 0; i < game.players.length; i++) {
    let p = game.players[i]
    if (!p.id) {
      continue;
    }

    let c = Object.keys(p.score).length
    if (c < min) {
      min = c;
      r = p.id;
    }
  }
  return r;
}

function broadcast() {
  if (!game.currentPlayer || !clients[game.currentPlayer]) {
    game.currentRoll = []
    game.currentPlayer = nextPlayer();
  }
  for (let userID in clients) {
    let idx = game.players.findIndex(e => e.id === userID);
    if (idx !== -1) {
      clients[userID].send(JSON.stringify({
        me: userID,
        ...game
      }));
    }
  }
}

function process(payload, userID) {
  if (payload.type === 'reset') {
    game = {
      players: [
        { name: 'Titi', score: {} },
        { name: 'Val', score: {} },
      ],
      currentRoll: [],
      currentPlayer: null,
    };
  } else if (payload.type === 'player') {
    game.players[payload.idx].id = userID;
  } else if (payload.type === 'newPlayer') {
    game.players.push({ name: payload.name, id: userID, score: {} });
  } else if (payload.type === 'score') {
    let idx = game.players.findIndex(e => e.id === userID);
    game.players[idx].score[payload.cat] = payload.score;
    game.currentRoll = []
    game.currentPlayer = nextPlayer();
  } else if (payload.type === 'roll') {
    let newRoll = []
    for (let i = 0; i < 5; i++) {
      if (payload.blocked[i]) {
        newRoll[i] = game.currentRoll[game.currentRoll.length - 1][i];
      } else {
        newRoll[i] = rand();
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
  var userID = getUniqueID();

  const connection = request.accept(null, request.origin);
  clients[userID] = connection;

  console.log('Client ' + userID + ' connected')

  connection.send(JSON.stringify(game));

  connection.on('message', (message) => {
    let payload = JSON.parse(message.utf8Data);
    // console.log(payload)
    process(payload, userID);
  });

  connection.on('close', () => {
    let idx = game.players.findIndex(e => e.id === userID);
    if (idx !== -1) {
      delete game.players[idx].id;
      delete clients[userID];
    }
  })
});
