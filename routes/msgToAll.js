var express = require('express');
var router = express.Router();
var ioclient = require('socket.io-client')
var socketForApis = ioclient.connect('http://localhost:3000', {reconnect: true});

// var io = require('socket.io');

/* GET users listing. */
router.get('/', function(req, res, next) {
  let queryStr = req.query;
  let userId = queryStr.userId;
  let message = queryStr.message
  console.log('===query===', queryStr);
  socketForApis.emit('message', {userId, message});
  res.send('message broadcasted successfully');
});

module.exports = router;
