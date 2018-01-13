const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const request = require('request-promise');
const mongoose = require('mongoose');
const { ObjectID } = require('mongodb');

const { Event } = require('./models/event');
const { User } = require('./models/user');

mongoose.connect('mongodb://dmlkforis:lkmskmcsd@cluster0-shard-00-00-topof.mongodb.net:27017,cluster0-shard-00-01-topof.mongodb.net:27017,cluster0-shard-00-02-topof.mongodb.net:27017/instagram?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin', { useMongoClient: true }, () => {
  console.log("Connected to mongodb...")
});

const PORT = process.env.PORT || 5000
const INSTAGRAM_API = 'https://api.instagram.com/';
const CLIENT_ID = '20d1ab5af77445d9b09a46eaa6e3bb0c';
const CLIENT_SECRET = 'add27729a01b41bead3d93da09581881';

const app = new Koa();
const router = new Router();

app.use(bodyParser());
app.use(cors());

router
  .get('/api/', (ctx, next) => {
    ctx.body = 'Hello World!';
  })

  .get('/api/user/:id', async (ctx, next) => {
    const id = ctx.params.id;

    if (!ObjectID.isValid(id)) {
      ctx.status = 404;
      return ctx.body = { message: 'User not found' };
    }

    const user = await User.findById(id);
    ctx.body = { message: 'Successfully getted the user', user };
  })

  .post('/api/user', async (ctx, next) => {
    const user = new User({
      name: ctx.request.body.name
    });

    await user.save();

    ctx.status = 201;
    ctx.body = { message: 'Successfully created the user', user };
  })

  .get('/api/events', async (ctx, next) => {
    let events = [];
    await Event.find().then(
      (ev) => { events = ev; console.log("AGORA FOI CARALHO")},
      (err) => console.log("QUE PORRA TA ACONTECENDO", err)
    );

    if (events.length == 0) {
      ctx.status = 204;
      return ctx.body = { message: 'No events yet' };
    }

    ctx.body = { message: 'Successfully getted all events', events };
  })

  .post('/api/events', async (ctx, next) => {
    const event = new Event({
      title: ctx.request.body.title,
      hashtags: ctx.request.body.hashtags,
      userId: ctx.request.body.userId
    });

    await event.save();

    ctx.status = 201;
    ctx.body = { message: 'Successfully created the event', event };
  })

  .put('/api/events', (ctx, next) => {
    ctx.body = { message: 'PUT /api/events - works' };
  })

  .get('/api/events/:id', async (ctx, next) => {
    const id = ctx.params.id;

    if (!ObjectID.isValid(id)) {
      ctx.status = 404;
      return ctx.body = { message: 'Event not found' };
    }

    const event = await Event.findById(id);
    const user = await User.findById(event.userId);
    
    if (user.access_token) {
      
      const photosPromise = [];

      event.hashtags.forEach(hashtag => {
        photosPromise.push(request({
          url: INSTAGRAM_API + `v1/tags/${hashtag}/media/recent?access_token=${user.access_token}`,
          method: 'GET',
          json: true
        }));
      });

      const photos = Promise.all(photosPromise);

      return ctx.body = { message: 'Successfully getted', event };
    } 
    
    ctx.status = 403;
    ctx.body = { message: 'No instagram authorized' };

  })

  .del('/api/events/:id', (ctx, next) => {
    ctx.body = { message: 'DELETE /api/events/:id - works' };
  })

  .get('/api/instagram/credentials', (ctx, next) => {
    const auth_params = {
      instagram_url: INSTAGRAM_API + 'oauth/authorize',
      client_id: CLIENT_ID,
      response_type: 'code',
      scope: 'public_content'
    }
    ctx.body = { message: 'Instagram oauth2 credentials', auth_params };
  })

  .get('/api/instagram/auth', async (ctx, next) => {
    
    const code = ctx.request.query.code;
    const eventId = ctx.request.query.eventId;
    const redirect_uri = ctx.request.query.redirect_uri;

    if (!ObjectID.isValid(eventId)) {
      ctx.status = 404;
      return ctx.body = { message: 'Invalid event' };
    }

    const auth_user = await request({
      uri: INSTAGRAM_API + 'oauth/access_token/',
      method: 'POST',
      form: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: `${redirect_uri}?eventId=${eventId}` ,
        code: code
      },
      json: true
    });

    const event = await Event.findById(eventId);

    await User.findByIdAndUpdate(event.userId,
      { $set: { access_token: auth_user.access_token } },
      { new: true }
    );

    ctx.body = { message: 'Succesfully authenticated' };

  });

// app.use(route.get('/api/tag/:user/:tag', async (ctx, user, tag) => {

//   tagVar = tag;

//   const access_token = await client.getAsync(user);
//   const code = ctx.request.query.code;
//   const redirect_uri = ctx.request.query.redirect_uri;

//   if (access_token) {

//     let photos = await request({
//       url: INSTAGRAM_API + `v1/tags/${tag}/media/recent?access_token=${access_token}`,
//       method: 'GET',
//       json: true
//     });

//     ctx.body = { message: 'Authenticated', images: photos.data };

//   } else if (code) {

//     let auth_user = await request({
//       uri: INSTAGRAM_API + 'oauth/access_token/',
//       method: 'POST',
//       form: {
//         client_id: CLIENT_ID,
//         client_secret: CLIENT_SECRET,
//         grant_type: 'authorization_code',
//         redirect_uri: redirect_uri,
//         code: code
//       },
//       json: true
//     });

//     await client.set(user, auth_user.access_token);

//     let photos = await request({
//       url: INSTAGRAM_API + `v1/tags/${tagVar}/media/recent?access_token=${auth_user.access_token}`,
//       method: 'GET',
//       json: true
//     });

//     ctx.body = { message: 'Authenticated', images: photos.data };

//   } else {
//     let auth_params = {
//       instagram_url: INSTAGRAM_API + 'oauth/authorize',
//       client_id: CLIENT_ID,
//       response_type: 'code',
//       scope: 'public_content'
//     }
//     ctx.body = { message: 'Not authenticated', auth_params };
//   };

// }));

app.use(router.routes());

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
