const loadsRouter = require('express').Router();
const middleware = require('../utils/middleware');
const datastore =  require('../utils/config');

const {checkAndValidateJWT, checkContentTypes, checkUnsupportedTypes, checkAndValidateLoadAttributes, fromDatastore} = middleware
const BOAT = "Boat";
const LOAD = "Load";
const USER = "User";

/* ------------- Begin Load Model Functions ------------- */
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
/* ------------- End Load Model Functions ------------- */



/* ------------- Begin Loads Controller Functions ------------- */
loadsRouter.get('/', 
    checkUnsupportedTypes,
    function (req, res) {
        get_loads(req)
            .then((loads) => {
                res.status(200).json(loads);
            });
});

loadsRouter.get('/:id', 
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

loadsRouter.post('/', 
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

loadsRouter.put('/:id', 
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

loadsRouter.patch('/:id', 
    checkContentTypes,
    checkUnsupportedTypes,
    checkAndValidateLoadAttributes,
    function (req, res) {
        patch_load(req.params.id, req.body.item, req.body.volume, req.body.creation_date)
            .then(load => {
                if (load === 404) {
                    res.status(404).json({ 'Error': 'No load with this load_id exists' });                
                }
                else if (load === 403) {
                    res.status(403).json({'Error': 'Not authorized to edit this load'})
                }
                else {
                    res.status(200).json(load);
                }
            });
});

loadsRouter.delete('/:id', function (req, res) {
    delete_load(req.params.id).then( output => {
        if (output === 204) {
            res.status(204).end()
        } else {
            res.status(404).json({ 'Error': 'No load with this load_id exists' });
        }
    })
});
/* ------------- End Loads Controller Functions ------------- */

module.exports = loadsRouter