const app = require("./src/app");
const PORT = process.env.PORT || 3000;

// TODO: Add Logger
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});