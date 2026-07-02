using Genie

ENV["GENIE_ENV"] = "dev"  # oder "prod"

Genie.config.run_as_server = false
Genie.config.server_host = "127.0.0.1"
Genie.config.server_port = 8000
Genie.config.websockets_server = true # enable the websockets server
Genie.config.server_document_root = normpath(joinpath(@__DIR__, ".."))
Genie.config.server_handle_static_files = true


# Lade die App
Genie.loadapp()

# Starte den Webserver
Genie.up()