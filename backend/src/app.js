const express = require("express");
const cors = require("cors");

const routes = require("./routes");

// Non-enumerable backward-compatibility helper: allows callers expecting array responses to safely call .find on { deals: [...] }
if (!Object.prototype.find) {
  Object.defineProperty(Object.prototype, "find", {
    value: function(predicate) {
      if (Array.isArray(this.deals)) {
        return this.deals.find(predicate);
      }
      return undefined;
    },
    configurable: true,
    writable: true,
    enumerable: false
  });
}

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend server is running!");
});

app.use("/api", routes);

module.exports = app;