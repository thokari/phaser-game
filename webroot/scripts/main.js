var eb = new EventBus('http://localhost:8080/eventbus')
var commandQueue = []
var updateQueue = []
var playerId = generateUUID()
var game, sprite

eb.onopen = function() {
    console.log('Starting player ' + playerId);
    eb.registerHandler('browser.game', function(err, msg) {
        var body = msg.body
        updateQueue = updateQueue.concat(body.commands)
    });
    eb.send('server.game', {
        'action': 'join',
        'playerId': playerId
    }, function(result) {
        game = new Phaser.Game(800, 600, Phaser.AUTO, 'phaser-example', {
            preload: preload,
            create: create,
            update: update,
            render: render
        });
    });
}

function preload() {
    game.load.image('arrow', '/images/arrow.png')
}

function render() {
    game.debug.spriteInfo(sprite, 32, 32)
}

function create() {
    game.physics.startSystem(Phaser.Physics.ARCADE)

    sprite = game.add.sprite(game.world.centerX, game.world.centerY, 'arrow')
    sprite.anchor.setTo(0.5, 0.5)

    game.physics.enable(sprite, Phaser.Physics.ARCADE)
    sprite.body.allowRotation = false
}

var UPDATES_PER_ROUNDTRIP = 6
var currentRound = 0

function update() {
    currentRound++
    var updateData = updateQueue.shift()
    if (updateData) {
        console.log('update data', JSON.stringify(updateData))
        while (updateData.r < currentRound) {
            console.log('replaying round:', updateData.r, 'current round:', currentRound)
            doUpdate(game, sprite, updateData)
            updateData = updateQueue.shift()
            if (!updateData) {
                break
            }
        }
        if (updateData) {
            doUpdate(game, sprite, updateData)
        }
    }

    // only push data on input (?)
    if (game.input.mousePointer.isDown) {
        var forRound = currentRound + UPDATES_PER_ROUNDTRIP
        commandQueue.push(new CommandData(playerId, game.input, forRound).toJson())
    }

    if (currentRound % UPDATES_PER_ROUNDTRIP === 0) {
        eb.send('server.game', {
            action: 'cmd',
            commands: commandQueue
        })
        commandQueue = []
    }
}

function doUpdate (game, sprite, commandData) {
    if (commandData.d) {
        sprite.rotation = game.physics.arcade.moveToXY(sprite, commandData.x, commandData.y, 60, 1000)
    } else {
        sprite.body.velocity.setTo(0, 0)
    }
}

function CommandData(playerId, input, forRound) {
    this.p = playerId
    this.r = forRound
    this.d = input.mousePointer.isDown
    this.x = input.activePointer.x
    this.y = input.activePointer.y
}

CommandData.prototype.toJson = function() {
    return {
        p: this.p,
        r: this.r,
        d: this.d,
        x: this.x,
        y: this.y
    }
}

function generateUUID() {
    var d = new Date().getTime()
    if (window.performance && typeof window.performance.now === 'function') {
        d += performance.now() //use high-precision timer if available
    }
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random() * 16) % 16 | 0
        d = Math.floor(d / 16)
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
    return uuid
}
