const mongoose = require('mongoose');

// Define flash card schema
const flashCardListSchema = new mongoose.Schema({
    vidID: { type: Number, required: true, unique: true },
    flashCardList: {
        title: { type: String, required: true },
        topic: { type: String, required: true },
        flashCards: [{
            cardID: { type: Number, required: true, unique: true },
            question: { type: String, required: true },
            answer: { type: String, required: true }
        }]
    }
});

// Create Flash Card model
const FlashCard = mongoose.model('flashCardListSchema', flashCardListSchema);

module.exports = FlashCard;
