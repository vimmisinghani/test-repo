var express = require('express');
var router = express.Router();
var ioclient = require('socket.io-client')
var socketForApis = ioclient.connect('http://localhost:3000', {reconnect: true});

// var io = require('socket.io');

/* GET users listing. */
router.get('/', function(req, res, next) {
  let queryStr = req.query;
  let userId = queryStr.userId;
  let username = queryStr.username
  console.log('===query===', queryStr);
  socketForApis.emit('create', {userId, username});
  res.send('respond with a resource...');
});

module.exports = router;
