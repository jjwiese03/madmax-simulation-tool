module Routes


using Genie, Genie.Router, Genie.WebChannels, Genie.Assets, JSON

path = joinpath(@__DIR__, "..", "frontend", "index.html")
@info path
@info isfile(path)

route("/") do
    @info joinpath(@__DIR__, "..", "frontend")

    serve_static_file(
        "index.html",
        root = joinpath(@__DIR__, "..", "frontend")
    )
end

channel("/Test/echo") do
    payload = params(:payload)
    # @echo payload

    JSON.json()
end

end