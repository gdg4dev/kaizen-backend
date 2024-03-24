const mongoose = require('mongoose');
// const autoIncrement = require('mongoose-auto-increment');

const videoSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    transcript: {
        type: String,
        default: ''
    }
});

// videoSchema.plugin(autoIncrement.plugin, { model: 'Video', field: '_id', startAt: 100001 });

const Video = mongoose.model('Video', videoSchema);

module.exports = Video;