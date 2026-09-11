require("dotenv").config();


const app = require("./app");

const PORT = 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});