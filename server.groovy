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

def eb = vertx.eventBus()
eb.consumer 'server.game', { msg ->
  def body = msg.body()
  if ('cmd' == body.action) {
    commands.addAll body.commands
  }
  if ('join' == body.action) {
    msg.reply([status: 'ok'])
  }
}

vertx.setPeriodic(100, {
    if (commands.size() > 0) {
      def message = [ commands: commands ]
      println 'sending some commands'
      eb.send('browser.game', message)
      commands = []
    }
})

router.route('/*').handler(StaticHandler.create().setCachingEnabled(false))
server.requestHandler(router.&accept).listen(8080)
