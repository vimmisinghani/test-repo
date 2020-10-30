var mongoose = require('mongoose');
const UserSchema = new mongoose.Schema(
	{
		userId: String,
		user: {
			type: String,
			trim: true
		},
		socketId: [Object]
	},
	{ collection: 'users', versionKey: false }
);
module.exports = mongoose.model('users', UserSchema);