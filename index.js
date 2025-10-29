require('dotenv').config();
const express = require('express');
const cors = require('cors');
const api = require('./api');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/community', api);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Community API listening on ${PORT}`);
});
