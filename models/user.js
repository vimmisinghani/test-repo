var mongoose = require('mongoose');
const UserSchema = new mongoose.Schema(
	{
		userId: String,
		user: {
			type: String,
			trim: true
		},
		socketId: [Object],
		msgSentCounter: Number,
		msgReceivedCounter: Number
	},
	{ collection: 'users', versionKey: false }
);
module.exports = mongoose.model('users', UserSchema);