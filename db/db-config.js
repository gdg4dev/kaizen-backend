const mongoose = require('mongoose')
mongoose.connect(`${process.env.KZ_MONGODB_URL}`, { useNewUrlParser: true })

// exports.autoIncrement = autoIncrement;