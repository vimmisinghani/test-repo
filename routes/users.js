var express = require('express');
var router = express.Router();
var connectToDatabase = require('../configs/db.js');
const { aggregateWithGroupBy, findOne, updateAll, create, upsert} = require('../services/database.js');
const userModel = require('../models/user.js');
// var buffer = require('buffer/').Buffer;

var ioclient = require('socket.io-client')
var socketForApis = ioclient.connect('http://localhost:443', {reconnect: true});

// var io = require('socket.io');

/* GET users listing. */
router.get('/', async(req, res, next) => {
  connectToDatabase();
  let queryStr = req.query;
  // console.log(Buffer.from("Hello World").toString('base64'));
  let username = queryStr.username
  let userId = Buffer.from(username).toString('base64')
  console.log('===query===', queryStr);
  // console.log('===res.io===', res.io);
  // let socketId = res.io.socket;
  let filterParams = {userId: userId};
  // let userdetails = await findOne(filterParams, userModel);
    // let socketIdArr =  (userdetails !== null) ? userdetails.socketId: [];
    // socketIdArr.push(socketId);

  let newUser = {
    user: username,
    id: userId
    // socketId: socketIdArr
  };
  console.log('===new user===', newUser);

  await upsert(filterParams, newUser, userModel);
  
  socketForApis.emit('create', {username});
  res.send('respond with a resource...');

});

module.exports = router;
