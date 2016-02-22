var eb = new EventBus('/eventbus')
var commandQueue = []
var updateQueue = []
var game, player1, player2
var ready = false

eb.onopen = function () {
    player1 = new Player(generateUUID())
    console.log('creating player ' + player1.id)
    eb.registerHandler('browser.game', function(err, msg) {
        var body = msg.body
        switch (body.action) {
            case 'ready':
                console.log('ready received')
                player2Id = body.playerIds.filter(function (pId) {
                    return pId !== player1.id
                })[0]
                player2 = new Player(player2Id)
                player2.game = game
                player2.createSprite()
                ready = true
                break
            case 'update':
                updateQueue = updateQueue.concat(body.commands)
                break
            default:
                break
        }
    })
    eb.send('server.game', {
        'action': 'init',
        'playerId': player1.id
    }, function(result) {
        game = new Phaser.Game(800, 600, Phaser.AUTO, 'phaser-example', {
            preload: preload,
            create: create,
            update: update,
            render: render
        })
        ready = false
    })
}

eb.onclose = function () {
    eb.send('server.game', {
        'action': 'disconnect',
        'playerId': player1.id
    })
}

function preload() {
    console.log('preloading')
    game.load.image('arrow', '/images/arrow.png')
}

function create() {
    console.log('creating')
    game.physics.startSystem(Phaser.Physics.ARCADE)

    player1.game = game
    player1.createSprite()

    eb.send('server.game', {
        'action': 'created',
        'playerId': player1.id
    }, function (reply) {
        console.log('got created reply')
        console.log(reply)
    })
}

var UPDATES_PER_ROUNDTRIP = 6
var currentRound = 0
var replaying = true

function update() {
    if (!ready) {
      console.log('not ready')
      return
    }
    currentRound++
    var updateData = updateQueue.shift()
    if (updateData) {
        while (updateData.r < currentRound) {
            replaying = true
            doUpdate(player1, player2, updateData)
            updateData = updateQueue.shift()
            if (!updateData) {
                break
            }
        }
        if (updateData) {
            replaying = false
            doUpdate(player1, player2, updateData)
        }
    }

    var forRound = currentRound + UPDATES_PER_ROUNDTRIP + 1
    commandQueue.push(new CommandData(player1.id, game.input, forRound).toJson())

    if (currentRound % UPDATES_PER_ROUNDTRIP === 0) {
        eb.send('server.game', {
            action: 'cmd',
            commands: commandQueue
        })
        commandQueue = []
    }
}

function doUpdate (player1, player2, updateData) {
    var p1Command = updateData.c.filter(byPlayerId(player1.id))[0]
    var p2Command = updateData.c.filter(byPlayerId(player2.id))[0]
    if (p1Command) {
        player1.update(p1Command)
    }
    if (p2Command) {
        player2.update(p2Command)
    }
}

function render() {
    game.debug.text('round: ' + currentRound, 32, 32)
    game.debug.text('commandQueue size: ' + commandQueue.length, 32, 48)
    game.debug.text('updateQueue size: ' + updateQueue.length, 32, 64)
    game.debug.text('replaying: ' + replaying, 32, 80)
}

function CommandData (playerId, input, forRound) {
    this.r = forRound,
    this.c = [{
        p: playerId,
        d: input.mousePointer.isDown,
        x: input.activePointer.x,
        y: input.activePointer.y
    }]
}

CommandData.prototype.toJson = function() {
    return {
        r: this.r,
        c: this.c,
    }
}

function Player (id) {
    this.id = id
    this.sprite = null
    this.game = null
}

Player.prototype.createSprite = function () {
    var game = this.game
    this.sprite = game.add.sprite(game.world.centerX, game.world.centerY, 'arrow')
    this.sprite.anchor.setTo(0.5, 0.5)
    game.physics.enable(this.sprite, Phaser.Physics.ARCADE)
    this.sprite.body.allowRotation = false
}

Player.prototype.update = function (command) {
    var game = this.game, sprite = this.sprite
    if (command.d) {
        sprite.rotation = game.physics.arcade.moveToXY(sprite, command.x, command.y, 60, 500)
        sprite.rotation = game.physics.arcade.moveToXY(sprite, command.x, command.y, 60, 500)
    } else {
        sprite.body.velocity.setTo(0, 0)
    }
}

var byPlayerId = function (playerId) {
    return function (command) {
        return (playerId === command.p)
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
