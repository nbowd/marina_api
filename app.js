// [START gae_flex_datastore_app]
'use strict';

const express = require('express');

const app = express();
app.enable('trust proxy');

const bodyParser = require('body-parser');

const oauthRouter = require('./routers/oauth');
const usersRouter = require('./routers/users');
const boatsRouter = require('./routers/boats');
const loadsRouter = require('./routers/loads');

app.use(bodyParser.json());

app.use('/login', oauthRouter);
app.use('/users', usersRouter);
app.use('/boats', boatsRouter);
app.use('/loads', loadsRouter);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});