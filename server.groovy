import io.vertx.groovy.ext.web.handler.StaticHandler
import io.vertx.groovy.ext.web.Router

def server = vertx.createHttpServer()
def router = Router.router(vertx)

router.route('/*').handler(StaticHandler.create().setCachingEnabled(false))

server.requestHandler(router.&accept).listen(8080)
