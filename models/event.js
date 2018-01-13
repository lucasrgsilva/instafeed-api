const mongoose = require('mongoose');

const Event = mongoose.model('Event', {
  title: {
    type: String,
    required: true,
    minlength: 1,
    trim: true
  },
  hashtags: {
    type: Array,
    required: true,
    minlength: 1
  },
  userId: {
    type: String,
    required: true,
    minlength: 1
  },
  date: {
    type: Date,
    default: new Date()
  }
});

module.exports = { Event };
