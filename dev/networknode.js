const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const rp = require('request-promise');
const uuid = require('uuid/v1');

const request = require('request');
const fs = require('fs');
const path = require('path');

const port = process.argv[2];
const currentNodeUrl = process.argv[3];

const Blockchain = require('./TheBlockchain');
const bitcoin = new Blockchain();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/static', express.static(__dirname +'/docDir')); 
  
var buff = null;  
let base64data = null;

app.get('/loadfile', function(req, res){
  request({encoding: 'base64', uri: currentNodeUrl+'/static/Campus.pdf', headers: { 'Content-type' : 'applcation/pdf' }} , function (error, response, body) {
    if (!error && response.statusCode == 200) {
      buff = body;
    }
    res.contentType("application/pdf");
    res.sendFile(path.join(__dirname, './docDir', 'Campus.pdf'));
  });
});

const nodeAddress = uuid().split('-').join('');

app.get('/blockchain', function (req, res) {
    res.send(bitcoin);
});

app.post('/transaction', function(req, res) {
  var newTransaction = req.body;
  if (buff != null){
      newTransaction.fileHash = bitcoin.hashFile(buff);
      buff = null;
  }
  const blockIndex = bitcoin.addTransactionToPendingTransactions(newTransaction);
  
  saveChain();

  res.json({ note:`Transaction will be added in block
      ${JSON.stringify(blockIndex)}.`
  });
});

app.get('/mine', function(req, res) {
    const lastBlock = bitcoin.getLastBlock();
    const previousBlockHash = lastBlock['hash'];

    const currentBlockData = {
        transactions: bitcoin.pendingTransactions,
        index: lastBlock['index'] + 1
      };

    const nonce = bitcoin.proofOfWork(previousBlockHash, currentBlockData); 
    const blockHash = bitcoin.hashBlock(previousBlockHash, currentBlockData, nonce);
    const newBlock = bitcoin.createNewBlock(nonce, previousBlockHash, blockHash);

    const requestPromises = [];
    bitcoin.networkNodes.forEach(networkNodeUrl => {
      const requestOptions = {
          uri: networkNodeUrl + '/receive-new-block',
          method: 'POST',
          body: { newBlock: newBlock },
          json: true
      }; 
      requestPromises.push(rp(requestOptions));
    });
    Promise.all(requestPromises)
    .then(data => {
        const requestOptions = {
          uri: bitcoin.currentNodeUrl + '/transaction/broadcast',
          method: 'POST',
          body: {
            amount: 12.5, 
            sender:"00", 
            recipient: nodeAddress
          },
          json: true
        };
        return rp(requestOptions);    
    });
    if (requestPromises.length < 1) saveChain();

    res.json({
        note: "New block mined successfully",
        block: newBlock
    });
});

app.post('/register-and-broadcast-node', function (req, res) {
  const newNodeUrl = req.body.newNodeUrl;

  if (bitcoin.networkNodes.indexOf(newNodeUrl) == -1 && 
      bitcoin.currentNodeUrl != newNodeUrl)

      bitcoin.networkNodes.push(newNodeUrl);
  const regNodesPromises = [];
  bitcoin.networkNodes.forEach(networkNodeUrl => {
    const requestOptions = {
      uri: networkNodeUrl +'/register-node',
      method:'POST',
      body: { newNodeUrl: newNodeUrl },
      json: true
    } 
    regNodesPromises.push(rp(requestOptions));   
  });
  Promise.all(regNodesPromises)
    .then(data => {
      const bulkRegisterOptions = { 
        uri: newNodeUrl + '/register-nodes-bulk',
        method: 'POST',
          body: {allNetworkNodes: [...bitcoin.networkNodes,
          bitcoin.currentNodeUrl]}, 
          json:true
      }; 
      return rp(bulkRegisterOptions);
    })
    .then(data => {
      if (bitcoin.pendingTransactions.length > 0){
         //syncPendingTransactions(newNodeUrl);
      }
        res.json({ note: `New node registered with network successfully. ${newNodeUrl}` });
    }).catch(function(err){
      console.log("Error is " + err);
    });
});

// register a node with the network
app.post('/register-node', function(req, res) {

  const newNodeUrl = req.body.newNodeUrl;
  const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(newNodeUrl) == -1; 
  const notCurrentNode = bitcoin.currentNodeUrl !== newNodeUrl;

  if (nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(newNodeUrl);

  res.json({ note:'New node registered successfully.' });
});

app.post('/register-nodes-bulk', function (req, res) {

    const allNetworkNodes = req.body.allNetworkNodes;
    console.log("Url's are " + allNetworkNodes);
    allNetworkNodes.forEach(networkNodeUrl => {
      const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(networkNodeUrl) == -1;
      const notCurrentNode = bitcoin.currentNodeUrl !== networkNodeUrl; 
      if(nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(networkNodeUrl);
    });
    res.json({note: 'Bulk registration successful.' });
});

app.post('/transaction/broadcast', function(req, res)  {
  var newTransaction = req.body;
  if (buff != null){
    newTransaction.fileHash = bitcoin.hashFile(buff);
    buff = null;
  }
  newTransaction = bitcoin.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
  bitcoin.addTransactionToPendingTransactions (newTransaction);

  const requestPromises = []; 
  bitcoin.networkNodes.forEach(networkNodeUrl => {
    const requestOptions = {
      uri: networkNodeUrl + '/transaction',
      method: 'POST',
      body: newTransaction,
      json: true
    };
    requestPromises.push(rp(requestOptions));
  });
  Promise.all(requestPromises)
  .then(data => {
    res.json({ note: 'Transaction created and broadcast successfully.'});
  });
});

app.post('/receive-new-block', function(req, res) {
  const newBlock = req.body.newBlock;
  const lastBlock = bitcoin.getLastBlock(); 

  const correctHash = lastBlock.hash === newBlock.previousBlockHash;
  const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

  if (correctHash && correctIndex) {
    bitcoin.chain.push(newBlock);
    bitcoin.pendingTransactions = [];
  }else{
    res.json({
        note:'New block rejected.',
        newBlock: newBlock
    });  
  }

  res.json({
    note: 'New block received and accepted.',
    newBlock: newBlock
  });
});

app.post('/syncTransactions', function(req, res) {
  const pendingTransaction = req.body;
  bitcoin.pendingTransactions.push(pendingTransaction);
  res.json({ note: `Transactions syncd with ${currentNodeUrl}`});
});

app.get('/consensus', function(req, res) {
  const requestPromises = [];
  bitcoin.networkNodes.forEach(networkNodeUrl => {
          const requestOptions = {
                  uri: networkNodeUrl + '/blockchain',
                  method: 'GET',
                  json: true 
          }        
          requestPromises.push(rp(requestOptions));
  });
  Promise.all(requestPromises)
  .then(blockchains => {
      const currentChainLength = bitcoin.chain.length;
      let maxChainLength = currentChainLength;
      let newLongestChain = null;
      let newPendingTransactions = null;

      blockchains.forEach(blockchain => {                
          if (blockchain.chain.length > maxChainLength) {
                  maxChainLength = blockchain.chain.length;
                  newLongestChain = blockchain.chain;
                  newPendingTransactions =
                  blockchain.pendingTransactions;
          };
      });
      if (!newLongestChain || (newLongestChain &&
          !bitcoin.chainIsValid(newLongestChain))) 
      {
          res.json({
              note: 'Current chain has not been replaced.',
              chain: bitcoin.chain
          });
      }else {
          bitcoin.chain = newLongestChain;
          bitcoin.pendingTransactions = newPendingTransactions;
          res.json({
              note: 'This chain has been replaced.',
              chain: bitcoin.chain
          });
      }    
  });    
});

app.get('/block/:blockHash', function(req, res) { 
  const blockHash = req.params.blockHash;
  const correctBlock = bitcoin.getBlock(blockHash);
  res.json({
    block: correctBlock
  });
});

app.get('/transaction/:transactionId', function(req, res) {
  const transactionId = req.params.transactionId;
  const   trasactionData = bitcoin.getTransaction(transactionId);
  res.json({
      transaction: trasactionData.transaction,
      block: trasactionData.block
  });   
});

app.get('/address/:address', function(req, res) {
  const address = req.params.address;
  const addressData = bitcoin.getAddressData(address);

  res.json({
           addressData: addressData
  });
});

app.get('/block-explorer', function(req, res) {
  res.sendFile('./block-explorer/index.html', { root: __dirname });
});

function syncPendingTransactions(networkNodeUrl){
  const pendingTransactions = []; 
  bitcoin.pendingTransactions.forEach(pendingTransaction => {
    const addPendingTransactions = {
      uri: networkNodeUrl + '/syncTransactions',
      method: 'POST',
      body: pendingTransaction,
      json: true
    };
    pendingTransactions.push(rp(addPendingTransactions));
    console.log("pendingTransactions " + JSON.stringify(addPendingTransactions));
  });
  
  Promise.all(pendingTransactions)
  .then(data => {
    console.log({ note: 'Kool is the rool old tool.'});
  });
}
function saveChain(){

  fs.open(path.join(__dirname, './docDir', 'chain.json'), 'w', function (err, file) {
    if (err) throw err;
  });

  fs.writeFile(path.join(__dirname, './docDir', 'chain.json'), JSON.stringify(bitcoin, null, 2), 'utf8', function(err){
    if (err) throw err;
  });
}

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
});