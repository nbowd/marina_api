const boatsRouter = require('express').Router();
const middleware = require('../utils/middleware');
const datastore =  require('../utils/config');

const {checkAndValidateJWT, checkContentTypes, checkUnsupportedTypes, checkAndValidateBoatAttributes, fromDatastore} = middleware
const BOAT = "Boat";
const LOAD = "Load";
const USER = "User";

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
/* ------------- End Boat Model Functions ------------- */


boatsRouter.get('/', 
    checkAndValidateJWT, 
    checkUnsupportedTypes,  
    function (req, res) {
        get_boats(req)
            .then((boats) => {
                res.status(200).json(boats)
            });  
});

boatsRouter.get('/:id', 
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

boatsRouter.post('/', 
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

boatsRouter.put('/:id',     
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

boatsRouter.patch('/:id', 
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

boatsRouter.delete('/:id', 
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

boatsRouter.put('/:boat_id/loads/:load_id', function (req, res) {
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

boatsRouter.delete('/:boat_id/loads/:load_id', function (req, res) {
    remove_load_from_boat(req.params.boat_id, req.params.load_id).then(output => {
        if (output === 204) {
            res.status(204).end()
        } 
        else {
            res.status(404).json({ 'Error': 'No boat with this boat_id is loaded with the load with this load_id' });
        }
    })
});

module.exports = boatsRouter