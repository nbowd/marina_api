const usersRouter = require('express').Router();

const axios = require('axios');
const middleware = require('../utils/middleware');
const datastore =  require('../utils/config');

const {checkUnsupportedTypes} = middleware
/* ------------- Begin Users Model Functions ------------- */
function get_users() {
    const q = datastore.createQuery(USER);
    return datastore.runQuery(q).then((entities) => {
        return entities[0].map(fromDatastore);
    });
}
/* ------------- End Model Functions ------------- */

/* ------------- Begin Users Controller Functions ------------- */
usersRouter.get('/', 
    checkUnsupportedTypes,
    function (req, res) {
        get_users()
            .then((users) => {
                res.status(200).json(users);
            });
});

usersRouter.put('/:id', function (req, res) {
    return res.status(405).set("Allow", "GET").send("Not Acceptable");
});

usersRouter.patch('/:id', function (req, res) {
    return res.status(405).set("Allow", "GET").send("Not Acceptable");
});

usersRouter.delete('/:id', function (req, res) {
    return res.status(405).set("Allow", "GET").send("Not Acceptable");
});
/* ------------- End Users Controller Functions ------------- */

module.exports = usersRouter