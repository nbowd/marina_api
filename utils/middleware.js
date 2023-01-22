const {OAuth2Client} = require('google-auth-library');

function fromDatastore(item) {
    item.id = item[Datastore.KEY].id;
    return item;
}

const client = new OAuth2Client(CLIENT_ID);

// Code adapted from https://www.geeksforgeeks.org/generate-random-alpha-numeric-string-in-javascript/
const generateState = () => {
    return Math.random().toString(36).slice(2);
}

async function verify(token) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: CLIENT_ID,  // Specify the CLIENT_ID of the app that accesses the backend
        // Or, if multiple clients access the backend:
        //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
    });
    const payload = ticket.getPayload();
    const userid = payload['sub'];
    return userid
  }

function onlyLettersAndNumbersandSpaces(str) {
    return /^[A-Za-z0-9\s]*$/.test(str);
}

function onlyLettersandSpaces(str) {
    return /^[A-Za-z\s]*$/.test(str);
}


function checkUnsupportedTypes(req, res, next) {
    if (req.get('Accept') !== 'application/json' && req.get('Accept') !== '*/*'){
        return res.status(406).json({'Error': 'The request is only accepting an unsupported type'})
    }
    next();    
}
function checkContentTypes(req, res, next) {
    if (req.get('Content-type') !== 'application/json') {
        return res.status(415).json({'Error': 'The request object is using an unsupported media type. This endpoint accepts only JSON'})
    }
    next();    
}

async function checkAndValidateJWT(req, res, next) {
    const token = req.get('Authorization')? req.get('Authorization').slice(7): null
    if (!token) {
        return res.status(401).json({"Error": "Invalid or missing token"})
    }
    let error = null;
    let userid = await verify(token, error).catch(e => error = e);
    if (error) {
        return res.status(401).json({"Error": "Invalid or missing token"})
    }
    req.userid = userid
    next();
}

async function checkAndValidateBoatAttributes(req, res, next) {
    if (Object.keys(req.body).length > 3) {
        res.status(400).json({ 'Error': 'The request object has too many attributes. Must contain exactly: name, type, length' });
        return
    }
    if (req.body.id) {
        res.status(400).json({'Error': 'Editing the id of the boat is not allowed'})
        return
    }
    if (req.method === 'POST' && (!req.body.name || !req.body.type || !req.body.length)) {
        res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
        return
    }
    if (req.method === 'PUT' && (!req.body.name || !req.body.type || !req.body.length)) {
        res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
        return
    }
    if (req.body.name) {
        const name = req.body.name        
        if (typeof name !== "string"){
            res.status(400).json({'Error': 'Invalid name: must be alphanumeric/spaces and between 2 and 64 characters long'})
            return
        }
    
        if (name.length < 2 || name.length > 64) {
            res.status(400).json({'Error': 'Invalid name: must be alphanumeric/spaces and between 2 and 64 characters long'})
            return
        }
    
        if (!onlyLettersAndNumbersandSpaces(name)){
            res.status(400).json({'Error': 'Invalid name: must be alphanumeric/spaces and between 2 and 64 characters long'})
            return
        }
    }

    if (req.body.type) {
        const type = req.body.type
        if (typeof type !== "string") {
            res.status(400).json({'Error': 'Invalid type: must contain only letters/spaces and between 2 and 30 characters long'});
            return
        }
    
        if (!onlyLettersandSpaces(type)) {
            res.status(400).json({'Error': 'Invalid type: must contain only letters/spaces and between 2 and 30 characters long'});
            return
        }
    
        if (type.length < 2 || type.length > 30) {
            res.status(400).json({'Error': 'Invalid type: must contain only letters/spaces and between 2 and 30 characters long'});
            return
        }
    }

    if (req.body.length) {
        const length = req.body.length
        if (typeof length !== "number"){
            res.status(400).json({'Error': 'Invalid length: must be a number'});
            return
        }
    }
    next();
}

function checkAndValidateLoadAttributes(req, res, next) {
    if (Object.keys(req.body).length > 3) {
        res.status(400).json({ 'Error': 'The request object has too many attributes. Must contain exactly: item, volume, creation_date' });
        return
    }
    if (req.body.id) {
        res.status(400).json({'Error': 'Editing the id of the load is not allowed'})
        return
    }
    if (req.method === 'POST' && (!req.body.item || !req.body.volume || !req.body.creation_date)) {
        res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
        return
    }
    if (req.method === 'PUT' && (!req.body.item || !req.body.volume || !req.body.creation_date)) {
        res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
        return
    }

    if (req.body.item) {
        const item = req.body.item
        if (typeof item !== "string"){
            res.status(400).json({'Error': 'Invalid item: must be alphanumeric/spaces and between 2 and 64 characters long'});
            return
        }
    
        if (item.length < 2 || item.length > 64) {
            res.status(400).json({'Error': 'Invalid item: must be alphanumeric/spaces and between 2 and 64 characters long'});
            return
        }
    
        if (!onlyLettersAndNumbersandSpaces(item)){
            res.status(400).json({'Error': 'Invalid item: must be alphanumeric/spaces and between 2 and 64 characters long'});
            return
        }
    }

    if (req.body.volume) {
        const volume = req.body.volume
        if (typeof volume !== "number") {
            res.status(400).json({'Error': 'Invalid volume: must be a number'});
            return
        }
    }

    if (req.body.creation_date) {
        const creation_date = req.body.creation_date
        if (typeof creation_date !== "string"){
            res.status(400).json({'Error': 'Invalid creation date: must be a string'});
            return
        }
    }

    next();
}

module.exports = {
    fromDatastore,
    generateState,
    verify,
    onlyLettersAndNumbersandSpaces,
    onlyLettersandSpaces,
    checkUnsupportedTypes,
    checkContentTypes,
    checkAndValidateJWT,
    checkAndValidateBoatAttributes,
    checkAndValidateLoadAttributes
}