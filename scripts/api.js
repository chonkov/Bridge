const express = require("express");
const app = express();
const PORT = 8000;

const { events } = require("./events");
const { lockedTokensEvents } = require("./lockedTokens");
const { burnedTokensEvents } = require("./burnedTokens");
const { filter } = require("./bridgedTokensByAddress");
const { getBridgedTokens } = require("./bridgedTokens");

app.get("/Events", (request, response) => {
  response.send(events);
});

app.get("/LockedTokens", (request, response) => {
  response.send(lockedTokensEvents);
});

app.get("/BurnedTokens", (request, response) => {
  response.send(burnedTokensEvents);
});

app.get("/BridgedTokens/:ByAddress", async (request, response) => {
  console.log(request.params.ByAddress);
  const result = await filter(request.params.ByAddress);
  response.send(result);
});

app.get("/BridgedTokens", async (request, response) => {
  const result = await getBridgedTokens();
  response.send(result);
});

app.get("/", (request, response) => {
  response.send("Some log...");
});

app.listen(PORT, () => {
  console.log(`Listening to port ${PORT}...`);
});
