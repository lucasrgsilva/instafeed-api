const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const _ = require('lodash');

const JWT_SECRET = process.env.JWT_SECRET;

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 1,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    unique: true,
    validate: {
      validator: validator.isEmail,
      message: '{VALUE} is not a valid email'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 4
  },
  tokens: [{
    access: {
      type: String,
      required: true
    },
    token: {
      type: String,
      required: true
    },
    isValid: {
      type: Boolean,
      default: true
    }
  }],
  access_token: {
    type: String
  },
  date: {
    type: Date,
    default: new Date()
  }
});

UserSchema.pre('save', function (next) {
  var user = this;

  if (user.isModified('password')) {
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(user.password, salt, (err, hash) => {
        user.password = hash;
        next();
      });
    });
  } else {
    next();
  }
});

// UserSchema.methods.toJSON = function () {
//   var user = this;
//   var userObject = user.toObject();

//   return _.pick(userObject, ['_id', 'email', 'name', 'date']);
// };

UserSchema.methods.generateAuthToken = function () {
  var user = this;
  var access = 'auth';
  var token = jwt.sign({ _id: user._id.toHexString(), access }, JWT_SECRET ).toString();

  user.tokens.push({ access, token });

  return user.save().then(() => {
    return token;
  });
};

UserSchema.statics.authenticate = function (email, password) {

  var User = this;

  return User.findOne({ email }).then((user) => {
    if (!user) {
      return Promise.reject('Email or password is invalid.');
    }

    return new Promise((resolve, reject) => {
      // Use bcrypt.compare to compare password and user.password
      bcrypt.compare(password, user.password, (err, res) => {
        if (res) {
          resolve(user);
        } else {
          reject('Email or password is invalid.');
        }
      });
    });
  });
}

UserSchema.statics.findByToken = function (token) {
  var User = this;
  var decoded;

  try {
    decoded = jwt.verify(token, JWT_SECRET);
    return User.findOne({
      '_id': decoded._id,
      'tokens.token': token,
      'tokens.access': 'auth',
      'tokens.isValid': true
    });
  } catch (e) {
    return Promise.reject(e);
  }
};

var User = mongoose.model('User', UserSchema);

module.exports = { User }
