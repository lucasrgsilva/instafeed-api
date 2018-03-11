const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const request = require('request-promise');
const mongoose = require('mongoose');
const { ObjectID } = require('mongodb');
const _ = require('lodash');

const { Event } = require('./models/event');
const { User } = require('./models/user');
const { Media } = require('./models/media');
const { auth_middleware } = require('./middleware/auth-middleware');

const app = new Koa();
const router = new Router();

const port = process.env.PORT;
const INSTAGRAM_API = process.env.INSTAGRAM_API;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

app.use(bodyParser());
app.use(cors());

router
  .get('/api/', auth_middleware, (ctx, next) => {
    ctx.body = 'It works!';
  })

  .post('/api/drop', async (ctx) => {
    try {
      await User.collection.drop();
      await Event.collection.drop();
      ctx.body = { message: 'ok' }
    } catch (error) {
      ctx.body = { error }
    }
  })

  .get('/api/user', auth_middleware, async (ctx, next) => {
    const user = await User.find();
    ctx.body = { message: 'Successfully getted', user };
  })

  .get('/api/user/:id', auth_middleware, async (ctx, next) => {
    const id = ctx.params.id;

    if (!ObjectID.isValid(id)) {
      ctx.status = 404;
      return ctx.body = { message: 'User not found' };
    }

    const user = await User.findById(id);
    ctx.body = { message: 'Successfully getted the user', user };
  })

  .post('/api/user', async (ctx, next) => {
    const body = _.pick(ctx.request.body, ['email', 'name', 'password']);
    const user = new User(body);

    try {
      const userSaved = await user.save();
      const token = await userSaved.generateAuthToken();

      ctx.status = 201;
      ctx.body = { message: 'Successfully authenticated', user: userSaved, data: { token } };
    } catch (error) {
      ctx.status = 400;
      ctx.body = { message: 'Something goes wrong', error };
    }
  })

  .get('/api/events', auth_middleware, async (ctx, next) => {
    const events = await Event.find();

    if (events.length == 0) {
      ctx.status = 204;
      return ctx.body = { message: 'No events yet' };
    }

    ctx.body = { message: 'Successfully getted all events', events };
  })

  .post('/api/events', auth_middleware, async (ctx, next) => {
    const event = new Event({
      title: ctx.request.body.title,
      hashtags: ctx.request.body.hashtags,
      userId: ctx.request.body.userId
    });

    await event.save();

    ctx.status = 201;
    ctx.body = { message: 'Successfully created the event', event };
  })

  .put('/api/events', auth_middleware, (ctx, next) => {
    ctx.body = { message: 'PUT /api/events - works' };
  })

  // .get('/api/media/recent', (ctx) => {
  //   const media = getRecentMedia();
  //   await (new Media(media)).save();
  //   ctx.body = media
  // })

  .get('/api/events/:id', auth_middleware, async (ctx, next) => {
    const id = ctx.params.id;

    if (!ObjectID.isValid(id)) {
      ctx.status = 404;
      return ctx.body = { message: 'Event not found' };
    }
    try {

      const event = await Event.findById(id);
      const user = await User.findById(event.userId);

      // let media = await Media.findByEventId(eventId);
      // if (!media.length) {
      //   media = getRecentMedia();
      //   await (new Media(media)).save();
      // }
      //
      // ctx.body = media

      if (user.access_token) {

        // const media = new Media({
        //   eventId: id,
        //   media: imagesFiltered
        // });

        // await media.save();

        getRecentMedia(user)

        return ctx.body = {
          message: 'Successfully getted',
          images: imagesFiltered
        };
      } else {
        ctx.status = 403;
        ctx.body = { message: 'No instagram authorized' };;
      }

    } catch (error) {
      ctx.status = 400;
      ctx.body = { message: 'Something goes wrong', error };;
    }

  })

  .del('/api/events/:id', auth_middleware, async (ctx, next) => {
    const id = ctx.params.id;
    // await Event.remove({});
    await Event.findOneAndRemove({ _id: id });

    ctx.body = { message: 'Successfully deleted' };
  })

  .get('/api/instagram/credentials', auth_middleware, (ctx, next) => {
    const auth_params = {
      instagram_url: INSTAGRAM_API + 'oauth/authorize',
      client_id: CLIENT_ID,
      response_type: 'code',
      scope: 'public_content'
    }
    ctx.body = { message: 'Instagram oauth2 credentials', auth_params };
  })

  .get('/api/instagram/auth', auth_middleware, async (ctx, next) => {

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
        redirect_uri: `${redirect_uri}?eventId=${eventId}`,
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

  })

  .post('/api/auth/login', async (ctx, next) => {
    const body = _.pick(ctx.request.body, ['email', 'password']);

    try {
      const user = await User.authenticate(body.email, body.password);
      const token = await user.generateAuthToken();

      ctx.body = { message: 'Successfully authenticated', user, data: { token } }
    } catch (error) {
      ctx.status = 400;
      ctx.body = { message: 'Authentication failed', error }
    }
  })

  .post('/api/auth/logout', async (ctx, next) => {
    const token = ctx.request.header['x-auth'];
    try {
      const user = await User.findByToken(token);
      user.tokens[user.tokens.findIndex(crr => crr.token === token)].isValid = false;

      await user.save();
      ctx.body = { message: 'Successfully logged out', user };
    } catch (error) {
      ctx.body = { error };
    }
  })

function getRecentMedia(event, access_token) {

  return Promise.all(event.hashtags.map(hashtag => {
    request({
      url: INSTAGRAM_API + `v1/tags/${hashtag}/media/recent?access_token=${access_token}`,
      method: 'GET',
      json: true
    })
  }));


  // event.hashtags.forEach(hashtag => {
  //   instagramPromise.push();
  // });

  // const images = await Promise.all(instagramPromise);
  // const imagesFiltered = images
  //   .reduce((accumulator, currentValue) => {
  //     return { data: [...accumulator.data, ...currentValue.data] };
  //   }, { data: [] }).data
  //   .filter((image, index, self) => {
  //     return index === self.findIndex(e => e.id === image.id);
  //   });

}

app.use(router.routes());

app.listen(port, () => console.log(`Listening on ${port}`));
