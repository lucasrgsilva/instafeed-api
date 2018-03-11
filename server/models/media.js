const mongoose = require('mongoose');

const Media = mongoose.model('Media', {
  eventId: {
    type: String,
    required: true,
    unique: true,
  },
  media: {
    type: Array
  },  
  date: {
    type: Date,
    default: new Date()
  }
});

module.exports = { Media };
