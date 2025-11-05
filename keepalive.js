import express from "express";
const app = express();

app.get("/", (req, res) => res.send("✅ Marcinho tá no ar!"));
app.listen(process.env.PORT || 3000, () =>
  console.log("🌐 Keepalive ativo na porta 3000")
);
