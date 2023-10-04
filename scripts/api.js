const express = require("express");
const app = express();
const PORT = 8000;

const { events } = require("./events");
const { lockedTokensEvents } = require("./lockedTokens");
const { burnedTokensEvents } = require("./burnedTokens");

app.get("/events", (request, response) => {
  response.send(events);
});

app.get("/lockedTokens", (request, response) => {
  response.send(lockedTokensEvents);
});

app.get("/burnedTokens", (request, response) => {
  response.send(burnedTokensEvents);
});

app.get("/", (request, response) => {
  response.send("Some log...");
});

app.listen(PORT, () => {
  console.log(`Listening to port ${PORT}...`);
});
