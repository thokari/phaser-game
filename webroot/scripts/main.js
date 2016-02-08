var eb = new EventBus('http://localhost:8080/eventbus')
var commandQueue = []
var updateQueue = []
var playerId = generateUUID()
var game, sprite

eb.onopen = function() {
  console.log('Starting player ' + playerId);
  eb.registerHandler('browser.game', function (err, msg) {
    var body = msg.body
    updateQueue = updateQueue.concat(body.commands)
  });
  eb.send('server.game', {
    'action': 'join',
    'playerId': playerId
  }, function (result) {
    game = new Phaser.Game(800, 600, Phaser.AUTO, 'phaser-example', {
      preload: preload,
      create: create,
      update: update,
      render: render
    });
  });
}

function preload() {
  game.load.image('arrow', '/images/arrow.png');
}

function render () {
  game.debug.spriteInfo(sprite, 32, 32);
}

function create() {
  game.physics.startSystem(Phaser.Physics.ARCADE);

  sprite = game.add.sprite(game.world.centerX, game.world.centerY, 'arrow');
  sprite.anchor.setTo(0.5, 0.5);

  game.physics.enable(sprite, Phaser.Physics.ARCADE);
  sprite.body.allowRotation = false;

  var commandTimer = function () {
    setTimeout(function () {
      if (commandQueue.length > 0) {
        console.log('sending something', JSON.stringify(commandQueue))
        eb.send('server.game', {
          action: 'cmd',
          commands: commandQueue
        })
        commandQueue = []
      } else {
        console.log('nothing to send', commandQueue)
      }
      commandTimer()
    }, 100)
  }
  commandTimer()
}

function update() {

  var updateVal = updateQueue.shift();
  while (updateVal) {
    console.log(updateVal)
    if ('down' == updateVal.input) {
      console.log('about to move')
      sprite.rotation = game.physics.arcade.moveToXY(sprite, updateVal.x, updateVal.y, 60, 1000);
    } else {
      sprite.body.velocity.setTo(0, 0);
    }
    updateVal = updateQueue.shift();
  }

  if (game.input.mousePointer.isDown) {
    commandQueue.push({
      playerId: playerId,
      input: 'down',
      x: game.input.activePointer.x,
      y: game.input.activePointer.y
    })
  }
}

function generateUUID() {
  var d = new Date().getTime();
  if (window.performance && typeof window.performance.now === "function") {
    d += performance.now(); //use high-precision timer if available
  }
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  return uuid;
}
