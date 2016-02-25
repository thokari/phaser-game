import io.vertx.groovy.ext.web.handler.StaticHandler
import io.vertx.groovy.ext.web.handler.sockjs.SockJSHandler
import io.vertx.groovy.ext.web.Router

def server = vertx.createHttpServer()
def router = Router.router(vertx)
def sockJSHandler = SockJSHandler.create(vertx, [:])

def inboundPermitted = [
    address: 'server.game'
]
def outboundPermitted = [
    address: 'browser.game'
]
def options = [
    inboundPermitteds: [
        inboundPermitted
    ],
    outboundPermitteds: [
        outboundPermitted
    ]
]
sockJSHandler.bridge(options)
router.route('/eventbus/*').handler(sockJSHandler)

def playerIds = []
def ready = false
CommandQueue commandQueue = new CommandQueue()
def start = new Date().time
def time = new Date().time

def eb = vertx.eventBus()
eb.consumer 'server.game', { msg ->
    def body = msg.body()
    switch (body.action) {
        case 'cmd':
            def commands = body.commands
            assert commands.size() == CommandQueue.UPDATES_PER_ROUNDTRIP
            def playerId = commands[0].p
            def fromRound = commands[0].r
            def toRound = commands[CommandQueue.UPDATES_PER_ROUNDTRIP - 1].r
            commandQueue.pushCommands(playerId, fromRound, toRound, commands*.c)
            if (ready && commandQueue.isBatchComplete()) {
                def commandsToSend = commandQueue.pullBatch()
                println "sending commands from round ${commandsToSend[0].r} to round ${commandsToSend[5].r}"
                time = new Date().time - start
                start = new Date().time
                println "took $time ms for tick"
                def message = [ action: 'update', commands: commandsToSend ]
                eb.publish('browser.game', message)
            }
            break
        case 'init':
            if (commandQueue.getPlayerCount() < CommandQueue.NUM_PLAYERS) {
                println 'Player joined.'
                msg.reply([status: 'ok'])
                commandQueue.addPlayer body.playerId
            } else {
                msg.reply([status: 'error', message: 'game full'])
            }
            break
        case 'created':
            if (commandQueue.getPlayerCount() == CommandQueue.NUM_PLAYERS) {
                println "${CommandQueue.NUM_PLAYERS} Players created game, game ready."
                eb.publish('browser.game', [
                    action: 'ready',
                    playerIds: commandQueue.playerIds as List
                ])
                ready = true
            } else {
                msg.reply([status: 'ok'])
                println '1 Player created game, waiting for another player.'
            }
            break
        case 'disconnect':
            println "Player ${body.playerId} disconnected"
            commandQueue.removePlayer body.playerId
            break
        default:
            break
    }
}

router.route('/*').handler(StaticHandler.create().setCachingEnabled(false))
server.requestHandler(router.&accept).listen(8080, '0.0.0.0')

class CommandQueue {

    static final int UPDATES_PER_ROUNDTRIP = 6
    static final int NUM_PLAYERS = 1

    private Set playerIds = [] as Set
    private Map commandsByPlayers = [:]
    private int minRound = UPDATES_PER_ROUNDTRIP + 4

    void pushCommands (playerId, fromRound, toRound, newCommands) {
        assert newCommands.size() == UPDATES_PER_ROUNDTRIP
        commandsByPlayers[playerId] += newCommands
        minRound = Math.min(minRound, fromRound)
    }

    boolean isBatchComplete () {
        def seenPlayers = []
        for (playerId in playerIds) {
            if (commandsByPlayers[playerId].size() >= UPDATES_PER_ROUNDTRIP) {
                seenPlayers << playerId
            }
        }
        def seenAll = seenPlayers.size() == NUM_PLAYERS
        seenPlayers = []
        return seenAll
    }

    def pullBatch () {
        def commands = []
        (0..UPDATES_PER_ROUNDTRIP - 1).each { roundOffset ->
            commands[roundOffset] = [
                r: minRound + roundOffset,
                c: []
            ]
        }
        for (playerId in playerIds) {
            def commandsForPlayer = commandsByPlayers[playerId]
            (0..UPDATES_PER_ROUNDTRIP - 1).each { roundOffset ->
                def roundCommandsForPlayer = commandsForPlayer[roundOffset]
                commands[roundOffset].c << [
                    p: playerId,
                    d: roundCommandsForPlayer.d,
                    x: roundCommandsForPlayer.x,
                    y: roundCommandsForPlayer.y
                ]
            }
            commandsByPlayers[playerId] = commandsByPlayers[playerId] - commandsByPlayers[playerId][0..UPDATES_PER_ROUNDTRIP - 1]
            println playerIds.findIndexOf { it == playerId } + ': ' + commandsByPlayers[playerId].size()
        }
        minRound += UPDATES_PER_ROUNDTRIP

        return commands
    }

    void addPlayer (playerId) {
        playerIds << playerId
        commandsByPlayers[playerId] = []
    }

    void removePlayer (playerId) {
        playerIds = playerIds - playerId
        commandsByPlayers.remove(playerId)
    }

    int getPlayerCount () {
        playerIds.size()
    }
}
