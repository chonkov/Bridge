const express = require("express");
const app = express();
const PORT = 8000;

const { events } = require("../scripts/events");
const { lockedTokensEvents } = require("../scripts/lockedTokens");
const { burnedTokensEvents } = require("../scripts/burnedTokens");
const { filter } = require("../scripts/bridgedTokensByAddress");
const { getBridgedTokens } = require("../scripts/bridgedTokens");

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
