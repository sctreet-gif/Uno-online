const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
const PORT = process.env.PORT || 3000;

let players = [];
let deck = [];
let currentCard = null;
let turnIndex = 0;
let direction = 1;

const colors = ["red","yellow","green","blue"];

function createDeck(){
  let d=[];

  colors.forEach(color=>{
    d.push({color,value:"0"});
    for(let i=1;i<=9;i++){
      d.push({color,value:String(i)});
      d.push({color,value:String(i)});
    }
    ["Skip","Reverse","+2"].forEach(action=>{
      d.push({color,value:action});
      d.push({color,value:action});
    });
  });

  for(let i=0;i<4;i++){
    d.push({color:"wild",value:"Wild"});
    d.push({color:"wild",value:"+4"});
  }

  return d.sort(()=>Math.random()-0.5);
}

function nextTurn(){
  turnIndex = (turnIndex + direction + players.length) % players.length;
}

function startGame(){
  deck=createDeck();
  players.forEach(p=>{
    p.hand=deck.splice(0,7);
  });
  currentCard=deck.pop();
  while(currentCard.color==="wild"){
    deck.unshift(currentCard);
    currentCard=deck.pop();
  }
  turnIndex=0;
  direction=1;
}

io.on("connection",socket=>{

  socket.on("join",(name)=>{
    players.push({id:socket.id,name,hand:[],uno:false});
    if(players.length>=2){
      startGame();
      io.emit("updateGame",{
        players,
        currentCard,
        turn:players[turnIndex].id
      });
    }
  });

  socket.on("playCard",data=>{
    if(players[turnIndex].id!==socket.id) return;

    let player=players.find(p=>p.id===socket.id);
    let card=data.card;

    let valid =
      card.color==="wild" ||
      card.color===currentCard.color ||
      card.value===currentCard.value;

    if(!valid) return;

    player.hand = player.hand.filter(
      c=>!(c.color===card.color && c.value===card.value)
    );

    if(card.color==="wild" && data.chosenColor){
      card.color=data.chosenColor;
    }

    currentCard=card;

    if(card.value==="+2"){
      nextTurn();
      players[turnIndex].hand.push(deck.pop(),deck.pop());
    }

    if(card.value==="+4"){
      nextTurn();
      players[turnIndex].hand.push(deck.pop(),deck.pop(),deck.pop(),deck.pop());
    }

    if(card.value==="Skip"){
      nextTurn();
    }

    if(card.value==="Reverse"){
      direction*=-1;
    }

    nextTurn();

    if(player.hand.length===1 && !player.uno){
      player.hand.push(deck.pop(),deck.pop());
    }

    if(player.hand.length===0){
      io.emit("gameOver",player.name);
      return;
    }

    io.emit("updateGame",{
      players,
      currentCard,
      turn:players[turnIndex].id
    });
  });

  socket.on("sayUNO",()=>{
    let player=players.find(p=>p.id===socket.id);
    if(player.hand.length===1){
      player.uno=true;
    }
  });

});

server.listen(PORT,()=>console.log("UNO running"));
