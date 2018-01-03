const Koa = require('koa');
const route = require('koa-route');
const request = require('request-promise');
const redis = require("redis");
const bluebird = require("bluebird");
const app = new Koa();
const client = redis.createClient({
    url: "redis://h:pe4f83e0de2a404ccc4eaeb7779e33289841caea0cb44ec920184d5d00a4ffe1d@ec2-34-233-217-71.compute-1.amazonaws.com:60699"
});

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const PORT = process.env.PORT || 5000
// const REDIRECT_URI = 'http://localhost:5000/api/auth/done';
// const REDIRECT_URI = 'https://instagallery-api.herokuapp.com/api/auth/done';
const INSTAGRAM_URL = 'https://api.instagram.com/';
const CLIENT_ID = '20d1ab5af77445d9b09a46eaa6e3bb0c';
const CLIENT_SECRET = 'add27729a01b41bead3d93da09581881';

let tagVar;

client.on('connect', () => {
    console.log("Connected on redis");
    // await client.quit()
});

client.on("error", (err) => {
    console.log("Error " + err);
});

app.use(route.get('/api/tag', async (ctx) => {
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    ctx.status = 400;
    ctx.body = { 'Message': 'No tag specified' };
}));

app.use(route.get('/api/tag/:user/:tag', async (ctx, user, tag) => {

    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    tagVar = tag;

    const access_token = await client.getAsync(user);
    const code = ctx.request.query.code;

    // ctx.body = { response: ctx.request.header.referer};

    if (access_token) {

        let photos = await request({
            url: INSTAGRAM_URL + `v1/tags/${tag}/media/recent?access_token=${access_token}`,
            method: 'GET',
            json: true
        });

        ctx.body = { message: 'Authenticated', images: photos.data };

    } else if (code) {

        let auth_user = await request({
            uri: INSTAGRAM_URL + 'oauth/access_token/',
            method: 'POST',
            form: {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                redirect_uri: 'ctx.request.header.referer',
                code: code
            },
            json: true
        });

        await client.set('access_token', auth_user.access_token);

        let photos = await request({
            url: INSTAGRAM_URL + `v1/tags/${tagVar}/media/recent?access_token=${auth_user.access_token}`,
            method: 'GET',
            json: true
        });

        ctx.body = { message: 'Authenticated', images: photos.data };

    } else {
        let auth_params = {
            instagram_url: INSTAGRAM_URL + 'oauth/authorize',
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            response_type: 'code',
            scope: 'public_content'
        }
        ctx.body = { message: 'Not authenticated', auth_params };
    };

}));

app.use(route.get('/api/auth/done', async (ctx, tag) => {
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');


}));

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
