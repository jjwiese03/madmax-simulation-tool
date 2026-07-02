module Routes

import Genie: Genie, Router, WebChannels, Assets, Renderer.Json.JSONParser

Router.route("/") do
    Genie.WebChannels.unsubscribe_disconnected_clients()

    html = read(joinpath(@__DIR__, "../frontend/index.html"), String)
    Genie.Renderer.Html.html(replace(html, "</body>" => Assets.channels_support("compute") * "</body>"))
end

Router.channel("/compute/echo") do
    socket = Router.params(:WS_CLIENT)
    payload = Router.params(:payload)
    @info "payload: $payload"

    WebChannels.message(socket, "test")
end

end