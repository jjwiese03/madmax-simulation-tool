module Routes

import Genie: Genie, Router, WebChannels, Assets, Renderer.Json.JSONParser

Router.route("/") do
    # remove dead WebSocket connections from the channel
    Genie.WebChannels.unsubscribe_disconnected_clients()

    # handle the request and return the HTML content
    html = read(joinpath(@__DIR__, "../frontend/index.html"), String)
    Genie.Renderer.Html.html(replace(html, "</body>" => Assets.channels_support("compute") * "</body>"))
end

Router.channel("/compute/echo") do
    # receive the WebSocket connection and the payload sent by the client
    socket = Router.params(:WS_CLIENT)
    payload = Router.params(:payload)

    # log the payload for debugging purposes
    @info "payload: $payload"

    # send a message back to the client through the WebSocket connection
    WebChannels.message(socket, "test")
end

end