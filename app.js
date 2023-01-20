
// [START gae_flex_datastore_app]
'use strict';

const express = require('express');
const axios = require('axios');

const {OAuth2Client} = require('google-auth-library');

const app = express();
app.enable('trust proxy');

const { Datastore } = require('@google-cloud/datastore');
const bodyParser = require('body-parser');

const datastore = new Datastore({
    projectId: 'portfolio-bowdenn',
  });

const BOAT = "Boat";
const LOAD = "Load";
const USER = "User";

const router = express.Router();

app.use(bodyParser.json());

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
/* ------------- Begin Boat Model Functions ------------- */
async function post_boat(req, name, type, length) {
    var key = datastore.key(BOAT);
    
    const boat_info = { "name": name, "type": type, "length": length, "owner": req.userid, "loads": [], "self": ""};
    await datastore.save({ "key": key, "data": boat_info })
    
    const new_info = {...boat_info, "self": "https://portfolio-bowdenn.wl.r.appspot.com/boats/"+ key.id}
    const new_boat = { "key": key, "data": new_info }
    await datastore.save(new_boat)
    
    return new_boat
}

async function get_boats(req) {
    let current_limit = 5;
    let current_offset = 0;
    if (Object.keys(req.query).includes('limit')) {
        current_limit = req.query.limit
    }
    if (Object.keys(req.query).includes('offset')) {
        current_offset = req.query.offset
    }
    let next_offset = parseInt(current_offset) + parseInt(current_limit)

    const q = datastore.createQuery(BOAT);
    return datastore.runQuery(q).then((entities) => {
        const all_boats = entities[0].map(fromDatastore);
        const filtered_boats = all_boats.filter(b => b.owner === req.userid) 

        let result = {"boats": filtered_boats.slice(current_offset, next_offset), "next": next_offset >= filtered_boats.length? null: `https://portfolio-bowdenn.wl.r.appspot.com/boats?offset=${next_offset}`}

        return result
    });

}

async function get_boat(req) {
    const key = datastore.key([BOAT, parseInt(req.params.id, 10)]);

    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            // No entity found. Don't try to add the id attribute
            return entity[0];
        } else {
            const all_boats = entity.map(fromDatastore);
            const filtered_boats = all_boats.filter(b => b.owner === req.userid)
            if (filtered_boats.length === 0) {
                return 403
            }
            return filtered_boats[0]
        }
    });
}

async function put_boat(req, id, name, type, length) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    
    return datastore.get(key).then( entity => {
        if (entity[0] === undefined || entity[0] === null) {
            // No entity found. Don't try to add the id attribute
            return 404;
        } else {
            const current_boat = entity.map(fromDatastore)[0];
            if (current_boat.owner !== req.userid) {
                return 403
            }
            const boat = {...current_boat, "name": name, "type": type, "length": length};
            datastore.save({ "key": key, "data": boat });
            return boat
        }
    })    
}

async function patch_boat(req, id, name, type, length) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);

    let invalid_boat = false;
    let current_boat = null;
    await datastore.get(key).then( entity => {
        if (entity[0] === undefined || entity[0] === null) {
            // No entity found. Don't try to add the id attribute
            invalid_boat = true;
        } else {
            current_boat = entity.map(fromDatastore)[0]
        }
    })
    if (invalid_boat){
        return 404
    }

    if (current_boat.owner !== req.userid) {
        return 403
    }

    const boat = {
        ...current_boat, 
        "name": name? name: current_boat.name, 
        "type": type? type: current_boat.type, 
        "length": length? length: current_boat.length, 
        "self": current_boat.self 
    };
    
    await datastore.save({ "key": key, "data": boat });
    return boat  
}

async function delete_boat(req, id) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);

    let invalid_boat = null;
    let current_boat = null;

    await datastore.get(key).then(entity => {
        if (entity[0] === undefined || entity[0] === null) {
            invalid_boat = true
        } else {
            invalid_boat = false
            current_boat = entity.map(fromDatastore)[0]
        }
    })

    if (invalid_boat) {
        return 404
    }

    if (current_boat.owner !== req.userid) {
        return 403
    }
    let current_load = null;
    if (current_boat.loads.length > 0) {
        await current_boat.loads.map(l => {
            const load_key = datastore.key([LOAD, parseInt(l.id, 10)]);
            datastore.get(load_key).then(entity=> {
                current_load = entity.map(fromDatastore)[0]
                const new_load = {...current_load, "carrier":null}
                datastore.save({ "key": load_key, "data": new_load })
            })
        })
    }

    await datastore.delete(key);
    return 204
}

function get_loads(req) {
    let current_limit = 5;
    let current_offset = 0;
    if (Object.keys(req.query).includes('limit')) {
        current_limit = req.query.limit
    }
    if (Object.keys(req.query).includes('offset')) {
        current_offset = req.query.offset
    }
    let next_offset = parseInt(current_offset) + parseInt(current_limit)

    const q = datastore.createQuery(LOAD);
    return datastore.runQuery(q).then((entities) => {
        let all_loads = entities[0].map(fromDatastore);
        let result = {"loads": all_loads.slice(current_offset, next_offset), "next": next_offset >= all_loads.length? null: `https://portfolio-bowdenn.wl.r.appspot.com/loads?offset=${next_offset}`}
        return result

    });
}

function get_load(id) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            // No entity found. Don't try to add the id attribute
            return entity;
        } else {
            // Use Array.map to call the function fromDatastore. This function
            // adds id attribute to every element in the array entity
            return entity.map(fromDatastore);
        }
    });
}

async function post_load(item, volume, creation_date) {
    var key = datastore.key(LOAD);
    const load_info = { "item": item, "volume": volume, "creation_date": creation_date, "carrier": null, "self": ""};
    await datastore.save({ "key": key, "data": load_info })
    const new_info = {...load_info, "self": "https://portfolio-bowdenn.wl.r.appspot.com/loads/"+ key.id}
    const new_load = { "key": key, "data": new_info }
    await datastore.save(new_load)
    return new_load
}

async function put_load(id, item, volume, creation_date) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);

    return datastore.get(key).then( entity => {
        if (entity[0] === undefined || entity[0] === null) {
            // No entity found. Don't try to add the id attribute
            return 404;
        } else {
            const current_load = entity.map(fromDatastore)[0];

            const load = {...current_load, "item": item, "volume": volume, "creation_date": creation_date};
            datastore.save({ "key": key, "data": load });
            return load
        }
    })    
}

async function patch_load(id, item, volume, creation_date) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);

    if (item && typeof item !== "string"){
        return 'invalid item'
    }

    if (item && (item.length < 2 || item.length > 64)) {
        return 'invalid item'
    }

    if (item && !onlyLettersAndNumbersandSpaces(item)){
        return 'invalid item'
    }

    if (creation_date && typeof creation_date !== "string") {
        return 'invalid creation date'
    }

    if (volume && typeof volume !== "number"){
        return 'invalid volume'
    }

    let invalid_load = false;
    let current_load = null;
    await datastore.get(key).then( entity => {
        if (entity[0] === undefined || entity[0] === null) {
            // No entity found. Don't try to add the id attribute
            invalid_load = true;
        } else {
            current_load = entity.map(fromDatastore)[0]
        }
    })
    if (invalid_load){
        return 404
    }

    const load = {...current_load, "item": item? item: current_load.item, "creation_date": creation_date? creation_date: current_load.creation_date, "volume": volume? volume: current_load.volume, "self": current_load.self };
    
    await datastore.save({ "key": key, "data": load });
    return load  
}

async function put_load_on_boat(load_id, boat_id) {
    const load_key = datastore.key([LOAD, parseInt(load_id, 10)]);
    const boat_key = datastore.key([BOAT, parseInt(boat_id, 10)]);

    let invalid_load = null;
    let invalid_boat = null;
    let occupied_load = null;
    let current_boat = null;
    let current_load = null;
    
    await datastore.get(load_key).then(entity => {
        if (entity[0] === undefined || entity[0] === null) {
            invalid_load = true;
        } else {
            invalid_load = false;
            current_load = entity.map(fromDatastore)[0]
        }
    })

    await datastore.get(boat_key).then(entity => {
        if (entity[0] === undefined || entity[0] === null) {
            // No entity found. Don't try to add the id attribute
            invalid_boat = true
        } else {
            invalid_boat = false
            current_boat = entity.map(fromDatastore)[0]
        }
    })

    if (invalid_load || invalid_boat) {
        return 404;
    }

    await datastore.get(load_key).then(load => {
        let load_info = load.map(fromDatastore)
        if (load_info[0].carrier !== null) {
            occupied_load = true;
        } else {
            occupied_load = false;
        }
    })

    if (occupied_load) {
        return 403
    }

    await datastore.get(load_key).then(load => {
        const new_load = {...load[0], "carrier": {"id": current_boat.id, "name": current_boat.name, "self":current_boat.self}}
        datastore.save({"key": load_key, "data": new_load})
        
    })

    await datastore.get(boat_key).then(boat => {
        const new_boat = {...boat[0], "loads": [...current_boat.loads, {"id": current_load.id, "self": current_load.self}]}
        datastore.save({"key": boat_key, "data":new_boat})
    })
    return 204;
}

async function remove_load_from_boat(boat_id, load_id) {
    const load_key = datastore.key([LOAD, parseInt(load_id, 10)]);
    const boat_key = datastore.key([BOAT, parseInt(boat_id, 10)]);

    let invalid_load = null;
    let invalid_boat = null;
    let id_mismatch = null;
    let current_load = null;
    let current_boat = null;
    
    await datastore.get(load_key).then(entity => {
        if (entity[0] === undefined || entity[0] === null) {
            invalid_load = true;
        } else {
            invalid_load = false;
            current_load = entity.map(fromDatastore)[0]
        }
    })
    await datastore.get(boat_key).then(entity => {
        if (entity[0] === undefined || entity[0] === null) {
            invalid_boat = true
        } else {
            invalid_boat = false
            current_boat = entity.map(fromDatastore)[0]
        }
    })

    if (invalid_load || invalid_boat) {
        return 404;
    }
    let boat_load_ids = current_boat.loads.map(b => b.id)

    if (!boat_load_ids.includes(current_load.id)) {
        id_mismatch = true;
    }

    if (!current_load.carrier || current_load.carrier.id !== current_boat.id) {
        id_mismatch = true;
    }

    if (id_mismatch) {
        return 404
    }

    let new_load = {...current_load, "carrier": null}
    await datastore.save({"key": load_key, "data": new_load})

    let new_boat_loads = current_boat.loads.filter(l => l.id !== current_load.id)
    let new_boat = {...current_boat, "loads": new_boat_loads}
    await datastore.save({"key": boat_key, "data": new_boat})
    return 204
}

async function delete_load(id) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);

    let invalid_load = null;
    let current_load = null;
    await datastore.get(key).then(entity => {
        if (entity[0] === undefined || entity[0] === null) {
            invalid_load = true
        } else {
            invalid_load = false
            current_load = entity.map(fromDatastore)[0]
        }
    })

    if (invalid_load) {
        return 404
    }

    if (current_load.carrier) {
        let boat_key = datastore.key([BOAT, parseInt(current_load.carrier.id, 10)]);
        let current_boat = null;
        
        await datastore.get(boat_key).then(entity => {
            if (entity[0] === undefined || entity[0] === null) {
                // No entity found. Don't try to add the id attribute
            } else {
                current_boat = entity.map(fromDatastore)[0]
            }
        })

        let new_boat_loads = current_boat.loads.filter(l => l.id !== current_load.id)
        let new_boat = {...current_boat, "loads": new_boat_loads}
        await datastore.save({"key": boat_key, "data": new_boat})
    }
    await datastore.delete(key);
    return 204

}

function get_users() {
    const q = datastore.createQuery(USER);
    return datastore.runQuery(q).then((entities) => {
        return entities[0].map(fromDatastore);
    });
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
/* ------------- End Model Functions ------------- */

/* ------------- Begin OAUTH Controller Functions ------------- */
router.get('/', function (req, res) {
    return res.send(`
        <div style="display:flex; justify-content:center;">
            <div style="display:flex; flex-direction:column; justify-content:center; width:400px;">
                <h1 style="font-weight:bold;" >Welcome to bowdenn's Portfolio Application </h1>
                <p>By clicking the button below, you will be redirect to login with a google account and the permission to access your email and profile will be requested. You will then be redirected to another page where your first and last name will be displayed, as well as the state variable used to secure the redirect.</p>
                <a href='//portfolio-bowdenn.wl.r.appspot.com/auth' style="text-decoration:none; background-color:gray; border: 1px solid black; border-radius: 12px; width: 80px; height: 28px;text-align: center; color: white; line-height: 28px" > Sign In </a>
            </div> 
        </div> 
    `)
});

router.get('/auth', async function (req, res) {
    const state = generateState();
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${CLIENT_ID}&redirect_uri=https://portfolio-bowdenn.wl.r.appspot.com/oauth&scope=profile&state=${state}`
    )
});

router.get('/oauth', async function (req, res) {
    const tokenResponse = await axios({
        method: 'post',
        url: 'https://oauth2.googleapis.com/token',
        headers: {'Accept-Encoding': 'application/json'},
        data: {
            code:req.query.code,
            client_id:CLIENT_ID,
            client_secret:CLIENT_SECRET,
            redirect_uri:'https://portfolio-bowdenn.wl.r.appspot.com/oauth',
            grant_type:'authorization_code'
        }
    })
    const profileResponse = await axios.get(
        'https://people.googleapis.com/v1/people/me?personFields=names', 
        { 
            headers: {
            'Authorization': 'Bearer ' + tokenResponse.data.access_token
            }
        }
    )

    let error = null;
    let userid = await verify(tokenResponse.data.id_token, error).catch(e => error = e);
    if (error) {
        return res.status(401).json({'Error': 'Login failure, please try again or on a different account'})
    }

    let duplicate_user = false;

    const q = datastore.createQuery(USER);
    await datastore.runQuery(q).then((entities) => {
        let all_users = entities[0].map(fromDatastore);

        let match_user = all_users.filter(u => u.userid === userid)

        duplicate_user = match_user.length !== 0
    });
    
    if (!duplicate_user) {
        var key = datastore.key(USER);
        const user_info = { "userid": userid };
        const user = { "key": key, "data": user_info }
        await datastore.save(user)
    }

    return res.status(200).send(`
        <div style="display:flex; justify-content:center;">
            <div style="
                display: flex;
                flex-direction: column;
                justify-content: center;
                width: 50%;
                max-width: 500px;
            ">
                <h1 style="font-weight: bold">Profile Information</h1>
                <p>Use this JWT when making requests to user owned entity endpoints</p>
                <ul style="list-style:none; padding:0;">
                    <li>Your User ID is: ${userid}</li>
                    <li style="overflow-wrap: anywhere;">Your JWT is: ${tokenResponse.data.id_token}</li>
                </ul>
            </div>
        </div>
    `)
});

router.get('/boats', 
    checkAndValidateJWT, 
    checkUnsupportedTypes,  
    function (req, res) {
        get_boats(req)
            .then((boats) => {
                res.status(200).json(boats)
            });  
});

router.get('/boats/:id', 
    checkAndValidateJWT, 
    checkUnsupportedTypes, 
    function (req, res) {
        get_boat(req)
            .then(boat => {
                if (boat === null || boat === undefined) {
                    res.status(404).json({ 'Error': 'No boat with this boat_id exists' });
                    return
                }  
                if (boat === 403) {
                    res.status(403).json({'Error': "Not authorized to view this boat"})
                    return
                }
                res.status(200).json(boat);
            }); 
});

router.post('/boats', 
    checkAndValidateJWT, 
    checkContentTypes, 
    checkUnsupportedTypes, 
    checkAndValidateBoatAttributes,
    function (req, res) {
        post_boat(req, req.body.name, req.body.type, req.body.length)
            .then(boat => { 
                res.status(201).json({ 
                    "id": boat.key.id, 
                    "name": boat.data.name , 
                    "type": boat.data.type, 
                    "length": boat.data.length, 
                    "owner": boat.data.owner, 
                    "loads": boat.data.loads, 
                    "self": boat.data.self})
            });
});

router.put('/boats/:id',     
    checkAndValidateJWT, 
    checkContentTypes, 
    checkUnsupportedTypes,
    checkAndValidateBoatAttributes,
        function (req, res) {
            put_boat(req, req.params.id, req.body.name, req.body.type, req.body.length)
                .then(boat => {
                    if (boat === 404) {
                        res.status(404).json({ 'Error': 'No boat with this boat_id exists' });                
                    }
                    else if (boat === 403) {
                        res.status(403).json({'Error': 'Not authorized to edit this boat'})
                    }          
                    else {
                        res.status(303).set('Location', boat.self).send('Boat updated');
                    }
                });
        }
);

router.patch('/boats/:id', 
    checkAndValidateJWT, 
    checkContentTypes, 
    checkUnsupportedTypes,
    checkAndValidateBoatAttributes,    
    function (req, res) {
        patch_boat(req, req.params.id, req.body.name, req.body.type, req.body.length)
            .then(boat => {
                if (boat === 404) {
                    res.status(404).json({ 'Error': 'No boat with this boat_id exists' });                
                }
                else if (boat === 403) {
                    res.status(403).json({'Error': 'Not authorized to edit this boat'})
                }
                else {
                    res.status(200).json(boat);
                }
            });
});

router.delete('/boats/:id', 
    checkAndValidateJWT,
    function (req, res) {
        delete_boat(req, req.params.id)
            .then( output => {
                if (output === 403) {
                    res.status(403).json({"Error": "Not authorized to delete this boat"});
                    return
                }
                if (output === 404) {
                    res.status(404).json({ 'Error': 'No boat with this boat_id exists' });
                    return
                }
                if (output === 204) {
                    res.status(204).end()
                    return
                } 
            })
});


router.get('/loads', 
    checkUnsupportedTypes,
    function (req, res) {
        get_loads(req)
            .then((loads) => {
                res.status(200).json(loads);
            });
});

router.get('/loads/:id', 
    checkUnsupportedTypes,
    function (req, res) {
        get_load(req.params.id)
            .then(load => {
                if (load[0] === undefined || load[0] === null) {
                    // The 0th element is undefined. This means there is no load with this id
                    res.status(404).json({ 'Error': 'No load with this load_id exists' });
                } else {
                    // Return the 0th element which is the load with this id
                    res.status(200).json(load[0]);
                }
            });
});

router.post('/loads', 
    checkContentTypes, 
    checkUnsupportedTypes,
    checkAndValidateLoadAttributes,
    function (req, res) {
        post_load(req.body.item, req.body.volume, req.body.creation_date)
            .then(boat => { res.status(201).json({ 
                "id": boat.key.id, 
                "item": boat.data.item , 
                "volume": boat.data.volume, 
                "creation_date": boat.data.creation_date, 
                "carrier": boat.data.carrier, 
                "self": boat.data.self}) 
            });
});

router.put('/loads/:id', 
    checkUnsupportedTypes,
    checkContentTypes,
    checkAndValidateLoadAttributes,
    function (req, res) {
        put_load(req.params.id, req.body.item, req.body.volume, req.body.creation_date)
            .then(load => {
                if (load === 404) {
                    res.status(404).json({ 'Error': 'No load with this load_id exists' });                
                }
                else {
                    res.status(303).set('Location', load.self).send('Load updated');
                }
            });
});

router.patch('/loads/:id', function (req, res) {
    if (req.get('Content-type') !== 'application/json') {
        return res.status(415).json({'Error': 'The request object is using an unsupported media type. This endpoint accepts only JSON'})
    }
    else if (req.get('Accept') !== 'application/json' && req.get('Accept') !== '*/*'){
        return res.status(406).json({'Error': 'The request is only accepting an unsupported type'})
    }
    else if (Object.keys(req.body).length > 3) {
        return res.status(400).json({ 'Error': 'The request object has too many attributes. Must contain exactly: item, volume, creation_date' });
    }
    else if (req.body.id) {
        return res.status(400).json({'Error': 'Editing the id of the load is not allowed'})
    }
    else {
    patch_load(req.params.id, req.body.item, req.body.volume, req.body.creation_date)
        .then(load => {
            if (load === 404) {
                res.status(404).json({ 'Error': 'No load with this load_id exists' });                
            }
            else if (load === 403) {
                res.status(403).json({'Error': 'Not authorized to edit this load'})
            }
            else if (load === 'invalid item') {
                return res.status(400).json({'Error': 'Invalid item: must be alphanumeric/spaces and between 2 and 64 characters long'})
            }
            else if (load === 'invalid creation date'){
                return res.status(400).json({'Error': 'Invalid creation date: must be a string'})
            }
            else if (load === 'invalid volume') {
                return res.status(400).json({'Error': 'Invalid volume: must be a number'})
            }
            else {
                res.status(200).json(load);
            }
        });
    }
});

router.put('/boats/:boat_id/loads/:load_id', function (req, res) {
    put_load_on_boat(req.params.load_id, req.params.boat_id).then(output => {
            if (output === 204) {
                res.status(204).end()
            }
            else if (output === 403) {
                res.status(403).json({ 'Error': 'The load is already loaded on another boat' });
            }
            else {
                res.status(404).json({ 'Error': 'The specified boat and/or load does not exist' });
            }
        });
});

router.delete('/boats/:boat_id/loads/:load_id', function (req, res) {
    remove_load_from_boat(req.params.boat_id, req.params.load_id).then(output => {
        if (output === 204) {
            res.status(204).end()
        } 
        else {
            res.status(404).json({ 'Error': 'No boat with this boat_id is loaded with the load with this load_id' });
        }
    })
});

router.delete('/loads/:id', function (req, res) {
    delete_load(req.params.id).then( output => {
        if (output === 204) {
            res.status(204).end()
        } else {
            res.status(404).json({ 'Error': 'No load with this load_id exists' });
        }
    })
});

router.get('/users', function (req, res) {
    if (req.get('Accept') !== 'application/json' && req.get('Accept') !== '*/*'){
        return res.status(406).json({'Error': 'The request is only accepting an unsupported type'})
    }
    else {
        const users = get_users()
            .then((users) => {
                res.status(200).json(users);
            });
    };
});

router.put('/users/:id', function (req, res) {
    return res.status(405).set("Allow", "GET").send("Not Acceptable");
});

router.patch('/users/:id', function (req, res) {
    return res.status(405).set("Allow", "GET").send("Not Acceptable");
});

router.delete('/users/:id', function (req, res) {
    return res.status(405).set("Allow", "GET").send("Not Acceptable");
});
/* ------------- End Controller Functions ------------- */


app.use('/', router);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});