const { User } = require('../models/user');

const auth_middleware = async (ctx, next) => {
  const token = ctx.request.header['x-auth'];

  try {
    const user = await User.findByToken(token);    
    await next();
  } catch (error) {
    ctx.status = 401
    ctx.body = { message: 'Not Authorired' };    
  }

};

module.exports = { auth_middleware };