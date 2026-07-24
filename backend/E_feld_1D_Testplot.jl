using LinearAlgebra
using StaticArrays
using Plots

include("transfer_matrix.jl")

const c0 = 299792458.

abstract type Space end
abstract type Dist <: Space end
abstract type Pos  <: Space end

abstract type Version end
abstract type PlaneWave <: Version end
abstract type WithAxion <: Version end

"""
Berechnet das E-Feld innerhalb der Schichten in einem 1D MADMAX Aufbau
wenn der Axionquellterm ignoriert wird. Entnimmt bisher nur distances.
"""
function calculate_field(::Type{PlaneWave}, freq::Real, distances::AbstractVector{<:Real}; eps::Real=24.0,tand::Real=0.0,thickness::Real=1e-3,nm::Real=1e15, dpi::Int=500)
    RB_single = transfer_matrix(Dist, [freq], distances; eps=eps, tand=tand, thickness=thickness, nm=nm)
    r = RB_single[1,1]
    
    ϵ  = eps*(1.0-1.0im*tand)
    nd = sqrt(ϵ)
    nm = complex(nm)

    G_d2v = SMatrix{2,2,ComplexF64}((1+nd)/2,   (1-nd)/2,   (1-nd)/2,   (1+nd)/2)
    G_v2d = SMatrix{2,2,ComplexF64}((nd+1)/2nd, (nd-1)/2nd, (nd-1)/2nd, (nd+1)/2nd)

    V = SVector{2,ComplexF64}(r, 1.0 + 0.0im) ## Amplitudenvektor von rechts! So dargestellt um Knirck nachzumachen

    z_vals = Float64[]
    E_vals = ComplexF64[]

    ## z=0 wird das rechteste Ende des MADMAX sein
    ## Wenn wir also iterieren addieren wir die Schichten auf
    current_z = sum(distances) + thickness*(length(distances)) ## Scheibenabstände plus Scheibendicke

    function propagate_through_layer(V_local::SVector{2,ComplexF64}, z_start::Float64, z_end::Float64, n::ComplexF64)
        ## Orte von links nach rechts in einer Region
        z_grid = range(z_start, z_end, length=dpi)

        ## starten aber am rechten Ende:
        for z in reverse(z_grid)
            dz = current_z - z
            phase = 2 * freq * n * dz / c0

            ## E Feld einer ebenen Welle
            E = V_local[1] *cispi(phase) + V_local[2] * cispi(-phase)
            push!(z_vals, z)
            push!(E_vals, E)
        end
        return z_start ## neues Ende
    end

    for i in Iterators.reverse(eachindex(distances))
        
        ## Ausgehend vom Vakuum gehen wir nun in die Scheibe
        V = G_v2d * V

        ## Wir verschieben unser Koordinatensystem gemäß der Scheibendicke
        z_next = current_z - thickness
        propagate_through_layer(V, z_next, current_z, nd)
        ## Berechnung von Positionen und E Feld

        ## neue Phasen berechnen und anschließend an unseren Amplitudenvektor hängen
        pd_right_disc = cispi(2*freq*nd*thickness/c0)
        pd_left_disc = cispi(-2*freq*nd*thickness/c0)
        V = SVector{2,ComplexF64}(V[1]*pd_right_disc, V[2]*pd_left_disc)

        ## update
        current_z = z_next

        ## Aus der disc austreten und Schritte wiederholen, nur diesmal fürs Vakuum
        V = G_d2v * V
        
        d = distances[i]
        z_next = current_z - d
        propagate_through_layer(V, z_next, current_z, complex(1.0))
        pd_right = cispi(2*freq*d/c0)
        pd_left = cispi(-2*freq*d/c0)
        V = SVector{2,ComplexF64}(V[1]*pd_right, V[2]*pd_left)
        current_z = z_next
    end
        
    ## Da wir von rechts nach links propagieren müssen wir alles umdrehen für den Plot
    reverse!(z_vals)
    reverse!(E_vals)

    return z_vals, E_vals
end

## Testaufruf (s. Knirck)
distance = [1.00334, 6.94754, 7.1766, 7.22788, 7.19717, 7.23776, 7.07746, 7.57173, 
            7.08019, 7.24657, 7.21708, 7.18317, 7.13025, 7.2198,  7.45585, 7.39873, 
            7.15403, 7.14252, 6.83105, 7.42282] * 1e-3

z_22, E_22 = calculate_field(PlaneWave, 22.005e9, distance; nm=1e30) ## 22.005e9 auch wegen Knirck. Hässliche Zahl

# theoretisch kann man schon hier das E Feld plotten, Knirck entscheidet sich aber den Imaginärteil wegzurotieren
# Stehende Wellen und so
ang = angle(E_22[end])

E_22_rot = E_22 .* exp(-1im * ang)
planarPlot = plot(z_22, real(E_22_rot), label="Re(E)", xlabel="z [m]", ylabel="E/E0", title="Ohne axion source")
plot!(planarPlot, z_22, imag(E_22_rot), label="Im(E)")
display(planarPlot)

"""
Berechnet das E-Feld eines 1D MADMAX Aufbaus, wenn der Axionquellterm berücksichtigt wird. Entimmt auch nur distances.
"""
function calculate_field(::Type{WithAxion}, freq::Real, distances::AbstractVector{<:Real}; eps::Real=24.0,tand::Real=0.0,thickness::Real=1e-3,nm::Real=1e15, dpi::Int=500)
    RB_single = transfer_matrix(Dist, [freq], distances; eps=eps, tand=tand, thickness=thickness, nm=nm)
    boost_amplitude = RB_single[1,2]

    ## Mit einbezug des Axions wird die Eingangsamplitude modifiziert, neuer Vektor V lautet:
    V=SVector{2,ComplexF64}(boost_amplitude, 0.0 + 0.0im)

    ϵ = eps*(1.0 - 1.0im*tand)
    nd = sqrt(ϵ)

    A = 1.0/ϵ - 1.0 ## Differenzterm (s. auch transfer_matrix.jl, hier allerdings getauscht um Knirck nahe zu sein)
    S_axion = SVector{2,ComplexF64}(A/2, A/2)

    G_d2v = SMatrix{2,2,ComplexF64}((1+nd)/2,   (1-nd)/2,   (1-nd)/2,   (1+nd)/2)
    G_v2d = SMatrix{2,2,ComplexF64}((nd+1)/2nd, (nd-1)/2nd, (nd-1)/2nd, (nd+1)/2nd)

    z_vals = Float64[]
    E_vals = ComplexF64[]

    current_z = sum(distances) + thickness*length(distances)

    ## Wir definieren eine neue propagate funktion, die eben noch den Axion Term berücksichtigt
    function propagate_through_layer(V_local::SVector{2,ComplexF64}, z_start::Float64, z_end::Float64, n::ComplexF64, eps_local::ComplexF64)
        z_grid = range(z_start, z_end, length=dpi)
        E_a = 1.0/eps_local

        for z in reverse(z_grid)
            dz = current_z - z
            phase = 2 * freq * n * dz / c0

            E_prop = V_local[1] * cispi(phase) + V_local[2] * cispi(-phase)
            E = -E_prop + E_a ## wenn rotiert wird, wird durch das Minuszeichen nicht ausversehen E_a beeinflusst

            push!(z_vals, z)
            push!(E_vals, E)
        end

        return z_start
    end

    for i in Iterators.reverse(eachindex(distances))
        V = G_v2d * V + S_axion ## Nun mit Axionquellterm

        z_next = current_z - thickness
        propagate_through_layer(V, z_next, current_z, nd, ϵ)

        pd_right_disc = cispi(2*freq*nd*thickness/c0)
        pd_left_disc = cispi(-2*freq*nd*thickness/c0)

        V = SVector{2, ComplexF64}(V[1]*pd_right_disc, V[2]*pd_left_disc)
        current_z = z_next

        ## Beim Austritt aus der Scheibe muss darauf geachtet werden, dass die Epsilons tauschen, daher -
        V = G_d2v * V - S_axion

        d = distances[i]
        z_next = current_z - d

        propagate_through_layer(V, z_next, current_z, complex(1.0), complex(1.0))
        pd_right = cispi(2*freq*d/c0)
        pd_left = cispi(-2*freq*d/c0)

        V = SVector{2,ComplexF64}(V[1]*pd_right, V[2]*pd_left)
        current_z = z_next

    end

    reverse!(z_vals)
    reverse!(E_vals)

    return z_vals, E_vals
end

# Testaufruf für Axionquellterm

freq = 22e9 + 5e6

z_22, E_axion = calculate_field(WithAxion, freq, distance)

E_axion_plot = E_axion .* exp(-1im * pi / 2 * 0.95)    ## auch von Knirck übernommen
axionPlot = plot(z_22, real(E_axion_plot), label="Re(E)", xlabel="z [m]", ylabel="E/E0"; nm=1e30)
plot!(axionPlot, z_22, imag(E_axion_plot), label="Im(E)")
display(axionPlot)