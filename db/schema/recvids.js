const mongoose = require('mongoose');
const recVidSchema = new mongoose.Schema({
    vidID: { type: Number, required: true, unique: true },
    rec: {
        title: { type: String, required: true },
        topic: { type: String, required: true },
        url: { type: String, required: true }
    }
});

const RecVid = mongoose.model('RecVid', recVidSchema);

module.exports = RecVid;