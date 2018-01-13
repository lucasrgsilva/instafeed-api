const mongoose = require('mongoose');

const User = mongoose.model('User', {
  name: {
    type: String,
    required: true,
    minlength: 1,
    trim: true
  },
  access_token: {
    type: String,
    required: false,
    minlength: 1,
    trim: true
  },
  date: {
    type: Date,
    default: new Date()
  }
});

module.exports = { User };
