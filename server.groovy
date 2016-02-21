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

def commands = []
def playerIds = []
def ready = false

def eb = vertx.eventBus()
eb.consumer 'server.game', { msg ->
    def body = msg.body()
    switch (body.action) {
        case 'cmd':
            updateCommands(body, commands)
            break
        case 'init':
            if (playerIds.size() < 2) {
                println 'Player joined.'
                msg.reply([status: 'ok'])
                playerIds << body.playerId
            } else {
                msg.reply([status: 'error', message: 'game full'])
            }
            break
        case 'created':
            if (playerIds.size() == 2) {
                println '2 Players created game, game ready.'
                eb.publish('browser.game', [
                    action: 'ready',
                    playerIds: playerIds
                ])
                ready = true
            } else {
                msg.reply([status: 'ok'])
                println '1 Player created game, waiting for another player.'
            }
            break
        case 'disconnect':
            println "Player ${body.playerId} disconnected"
            playerIds = playerIds - body.playerId
            break
        default:
            break
    }
}

def updateCommands (body, commands) {
    // println "${commands*.c*.d}"
    if (commands.size() > 0) {
        def (toPrepend, rest) = body.commands.split { it.r < commands[0]?.r }
        def (toMerge, toAppend) = rest.split { it.r <= commands[-1]?.r }
        for(mergeCmd in toMerge) {
            for(queuedCmd in commands) {
                queuedCmd.c.addAll(mergeCmd.c)
            }
        }
        commands.addAll(0, toPrepend)
        commands.addAll(toAppend)
    } else {
        commands.addAll(body.commands)
    }
}

vertx.setPeriodic(100, {
    if (ready && commands.size() > 0) {
        def message = [ action: 'update', commands: commands ]
        eb.publish('browser.game', message)
        commands = []
    }
})

router.route('/*').handler(StaticHandler.create().setCachingEnabled(false))
server.requestHandler(router.&accept).listen(8080)
