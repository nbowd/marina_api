const oauthRouter = require('express').Router();

const axios = require('axios');
const middleware = require('../utils/middleware');
const datastore =  require('../utils/config');

const {generateState, verify} = middleware

/* ------------- Begin OAUTH Controller Functions ------------- */
oauthRouter.get('/', function (req, res) {
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

oauthRouter.get('/auth', async function (req, res) {
    const state = generateState();
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${CLIENT_ID}&redirect_uri=https://portfolio-bowdenn.wl.r.appspot.com/oauth&scope=profile&state=${state}`
    )
});

oauthRouter.get('/oauth', async function (req, res) {
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
/* ------------- End OAUTH Controller Functions ------------- */

module.exports = oauthRouter