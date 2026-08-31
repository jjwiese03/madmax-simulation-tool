using LinearAlgebra
using StaticArrays
using Plots

include("transfer_matrix.jl")

const c0 = 299792458.

# Default configuration
thickness = 0.2*10^-2
distance = [2.622, 0.824, 1.252, 0.798] * 10^-2

abstract type Space end
abstract type Dist <: Space end
abstract type Pos  <: Space end

abstract type Version end
abstract type PlaneWave <: Version end
abstract type WithAxion <: Version end

"""
    calculate_field(::Type{PlaneWave}, freqs::AbstractVector{<:Real}, distances::AbstractVector{<:Real}; eps::Real=24.0,tand::Real=0.0,thickness::Real=1e-3,nm::Real=1e15, dpi::Int=500)

Calculate the E-Field of an externally stimulated 1D MADMAX setup. A mirror is expected in this setup.

# Arguments
- `::Type{PlaneWave}`: Placeholder Argument for Multiple dispatch to distinguish between the reflexion and axion induced case
- `freqs::AbstractVector{<:Real}`: an array of frequencies if one may want to analyse the fields from multiple frequencies
- `distances::AbstractVector{<:Real}`: an array of distances between the discs (also interpreted as lengths of the vacuum parts)
- `eps::Real=24`: dielectric constant for a disc. It's assumed that every disc has same ϵ
- `tand::Real=0.0`: loss tangent of the dielectric disc.
- `thickness::Real`: the thickness of the disc.
- `nm::Real=1e15`: the refractive index of the mirror
- `dpi::Int`: the number of points in each vacuum/disc region for the E field

# Returns
- `z_vals`: a 1 dimensional array of z positions for the final plot of the E field
- `E_vals`: a matrix of size length(points) x length(freqs), rows correspond to a position and columns correspond to a frequency, so that each frequency can be projected

# Example
Calculate the E_field for frequencies of a given range and a simple disc setup for the externally induced case.
```jldoctest
julia> zPlane, EPlane = calculate_field(PlaneWave, 22e9:1e6:22.05e9, [1, 2, 3, 4]*1e-3)
```
"""
function calculate_field(::Type{PlaneWave}, freqs::AbstractVector{<:Real}, distances::AbstractVector{<:Real}; eps::Real=24.0,tand::Real=0.0,thickness::Real=1e-3,nm::Real=1e15, dpi::Int=500)
    # Our default amplitude Vector V will equal (r, 1), with r the reflexion coefficient (the response of our system) and
    # 1 as a standardised incoming amplitude. Therefore we have to calculate r for every frequence with transfer_matrix()
    RB_all = transfer_matrix(Dist, freqs, distances; eps=eps, tand=tand, thickness=thickness, nm=nm)
    
    # Turn eps complex and calculate the refractive index of every disc, turn the refractiv index of the mirror complex
    # it is assumed, that the empty space is approximated as vacuum, we therefore set nv = 1.0 and ignore it's possible influence in future equations
    ϵ  = eps*(1.0-1.0im*tand)
    nd = sqrt(ϵ)
    nm = complex(nm)

    # We can turn our computation into two parts: Entering a disc (vacuum -> disc), and exiting a disc (disc -> vacuum). Both
    # cases can be expressed with a matrix G. We neglect the P matrix, by simply adding the phase to our new V after propagating through
    # a layer
    G_d2v = SMatrix{2,2,ComplexF64}((1+nd)/2,   (1-nd)/2,   (1-nd)/2,   (1+nd)/2)
    G_v2d = SMatrix{2,2,ComplexF64}((nd+1)/2nd, (nd-1)/2nd, (nd-1)/2nd, (nd+1)/2nd)

    # calculate the total number of points. We ignore the last vacuum region for plotting.
    total_points = 2*length(distances)*dpi

    # compute placeholder values for faster computation of final positon and field matrix
    # each column of E_vals corresponds to a frequency in freqs, while rows correspond to the position
    z_vals = zeros(Float64, total_points)
    E_vals = zeros(ComplexF64, total_points, length(freqs))

    # We propagate from the right (we call it the end of the MADMAX setup), therefore we have to find the leftmost z value as a start
    current_z_init = sum(distances) + thickness*(length(distances))

    # nest two for loops to build the E matrix
    for j in eachindex(freqs)
        freq = freqs[j]

        # first column of RB_all corresponds to reflexion coefficient r
        r = RB_all[j,1]

        # incoming wave from the right
        V = SVector{2,ComplexF64}(r, 1.0 + 0.0im)

        # refresh column index for each iteration and go back to the end of MADMAX
        current_z = current_z_init
        idx = 1

        for i in Iterators.reverse(eachindex(distances))
            
            # current V are the field amplitudes in vacuum. First propagate from vacuum to disc by multiplying with G_v2d
            V = G_v2d * V

            # We find our boundaries inside the disc by subtracting the thickness of the disc from our current position
            # initialise z range inside disc
            z_next = current_z - thickness
            z_grid = range(z_next, current_z, length=dpi)

            # reverse the range to go from right to left
            for z in reverse(z_grid)
                # to avoid refilling z_vals everytime
                j==1 && (z_vals[idx]=z)

                # For the visualisation, we dissect the propagation in little dz steps (dz is difference between current positon and rightmost edge)
                # and calculate the resulting phase. 
                # add up incoming and outcoming waves for total E and place it in each row
                dz = current_z - z
                phase = 2 * freq * nd * dz / c0
                E_vals[idx, j] = V[1] * cispi(phase) + V[2] * cispi(-phase)
                idx += 1
            end

            # Take big step into next region and update the amplitude Vector accordingly
            pd_right_disc = cispi(2 * freq * nd * thickness / c0)
            pd_left_disc = cispi(-2 * freq * nd * thickness / c0)
            V = SVector{2,ComplexF64}(V[1]*pd_right_disc, V[2]*pd_left_disc)
            
            # update position so that leftmost boundary is new posion
            current_z = z_next

            # repeat the same steps but now for disc -> vacuum
            V = G_d2v * V
            
            d = distances[i]
            z_next = current_z - d
            z_grid = range(z_next, current_z, length=dpi)

            for z in reverse(z_grid)
                if j==1; z_vals[idx] = z; end
                dz = current_z - z
                phase = 2 * freq * 1.0 * dz /c0
                E_vals[idx, j] = V[1] * cispi(phase) + V[2] * cispi(-phase)
                idx += 1
            end

            pd_right = cispi(2*freq*d/c0)
            pd_left = cispi(-2*freq*d/c0)
            V = SVector{2,ComplexF64}(V[1]*pd_right, V[2]*pd_left)
            current_z = z_next
        end
    end
        
    # Since we went from right to left, reverse position array and rows in matrix
    reverse!(z_vals)
    E_vals = E_vals[end:-1:1, :]

    return z_vals, E_vals
end

"""
    calculate_field(::Type{WithAxion}, freqs::AbstractVector{<:Real}, distances::AbstractVector{<:Real}; eps::Real=24.0,tand::Real=0.0,thickness::Real=1e-3,nm::Real=1e15, dpi::Int=500)

Calculate the E-Field of an internally stimulated 1D MADMAX through axion to photon conversion. Expects a mirror on the left side.

# Arguments
- `::Type{WithAxion}`: Placeholder Argument for Multiple dispatch to distinguish between the reflexion and axion induced case
- `freqs::AbstractVector{<:Real}`: an array of frequencies if one may want to analyse the fields from multiple frequencies
- `distances::AbstractVector{<:Real}`: an array of distances between the discs (also interpreted as lengths of the vacuum parts)
- `eps::Real=24`: dielectric constant for a disc. It's assumed that every disc has same ϵ
- `tand::Real=0.0`: loss tangent of the dielectric disc.
- `thickness::Real`: the thickness of the disc.
- `nm::Real=1e15`: the refractive index of the mirror
- `dpi::Int`: the number of points in each vacuum/disc region for the E field

# Returns
- `z_vals`: a 1 dimensional array of z positions for the final plot of the E field
- `E_vals`: a matrix of size length(points) x length(freqs), rows correspond to a position and columns correspond to a frequency, so that each frequency can be projected

# Example
Calculate the E_field for frequencies of a given range and a simple disc setup for the internally induced case.
```jldoctest
julia> zAxion, EAxion = calculate_field(WithAxion, 22e9:1e6:22.05e9, [1, 2, 3, 4]*1e-3)
```
"""
function calculate_field(::Type{WithAxion}, freqs::AbstractVector{<:Real}, distances::AbstractVector{<:Real}; eps::Real=24.0,tand::Real=0.0,thickness::Real=1e-3,nm::Real=1e15, dpi::Int=500)
    # The setup is almost the same, but consider the following changes marked in #

    RB_all = transfer_matrix(Dist, freqs, distances; eps=eps, tand=tand, thickness=thickness, nm=nm)

    ϵ = eps*(1.0 - 1.0im*tand)
    nd = sqrt(ϵ)

    # We can calculate the axion induced term via -E0/eps, where we almost always consider a case with E0 = 1
    # between two dielectric surfaces the difference 1/eps_d - 1/eps_v = 1/ϵ - 1 is calculated. This is expressed through A
    # and inserted in S_axion
    A = 1.0/ϵ - 1.0
    S_axion = SVector{2,ComplexF64}(A/2, A/2)

    G_d2v = SMatrix{2,2,ComplexF64}((1+nd)/2,   (1-nd)/2,   (1-nd)/2,   (1+nd)/2)
    G_v2d = SMatrix{2,2,ComplexF64}((nd+1)/2nd, (nd-1)/2nd, (nd-1)/2nd, (nd+1)/2nd)

    total_points = 2 * length(distances) * dpi
    z_vals = zeros(Float64, total_points)
    E_vals = zeros(ComplexF64, total_points, length(freqs))

    current_z_init = sum(distances) + thickness*length(distances)

    for j in eachindex(freqs)
        freq = freqs[j]

        # This time no external field is induced into the system. Therefore the incoming wave has amplitude 0, while
        # we expect the converted axion field to be boosted to value β. therefore V = (β, 0)
        β = RB_all[j, 2]
        V = SVector{2,ComplexF64}(β, 0.0 + 0.0im)

        current_z = current_z_init
        idx = 1

        for i in Iterators.reverse(eachindex(distances))
            V = G_v2d * V + S_axion

            z_next = current_z - thickness
            z_grid = range(z_next, current_z, length=dpi)

            # in each region, the axion term is a simple constant E_a. We follow Knircks convention, therefore the minus sign is omitted
            E_a = 1.0/ϵ
            
            for z in reverse(z_grid)
                if j==1; z_vals[idx] = z; end
                dz = current_z - z
                phase = 2 * freq * nd * dz / c0

                # We add the plane wave term with a minus sign, so the rotation in the end turns out correct
                E_prop = V[1] * cispi(phase) + V[2] * cispi(-phase)
                E_vals[idx, j] = -E_prop + E_a
                idx += 1
            end

            pd_right_disc = cispi(2*freq*nd*thickness/c0)
            pd_left_disc = cispi(-2*freq*nd*thickness/c0)

            V = SVector{2, ComplexF64}(V[1]*pd_right_disc, V[2]*pd_left_disc)
            current_z = z_next

            V = G_d2v * V - S_axion

            d = distances[i]
            z_next = current_z - d
            z_grid = range(z_next, current_z, length=dpi)

            # obvious
            E_a_vac = 1.0
            for z in reverse(z_grid)
                if j==1; z_vals[idx] = z; end
                dz = current_z - z
                phase = 2 * freq * 1.0 * dz / c0
                E_prop = V[1] * cispi(phase) + V[2] * cispi(-phase)
                E_vals[idx, j] = -E_prop + E_a_vac
                idx += 1
            end

            pd_right = cispi(2*freq*d/c0)
            pd_left = cispi(-2*freq*d/c0)

            V = SVector{2,ComplexF64}(V[1]*pd_right, V[2]*pd_left)
            current_z = z_next
        end
    end

    reverse!(z_vals)
    E_vals = E_vals[end:-1:1, :]

    return z_vals, E_vals
end

"""
    calculate_field(T::Type{<:Version}, freq::Real, distances::AbstractVector; kwargs...)

A wrapper function if one might consider a single frequency in our setup

# Arguments
- `T::Type{<:Version}`: Placeholder value to distinguish between externally and internally induced case
- `freq::Real`: a single frequency of an E field inside the system
- `distances::AbstractVector`: an array of distances between the discs
- `kwargs...`: optional parameters, see also documentation of calculate_field

# returns
- `z_vals`: array of positions for each E field
- `E_vals`: array of E field strengths for each position

# Examples
Calculate the E_field for frequencies of a given range and a simple disc setup for both cases
```jldoctest
julia> zAxion, EAxionSingle = calculate_field(WithAxion, 22.05e9, [1, 2, 3, 4]*1e-3)

julia> zPlane, EPlaneSingle = calculate_field(PlaneWave, 22.05e9, [1, 2, 3, 4]*1e-3)
```
"""
function calculate_field(T::Type{<:Version}, freq::Real, distances::AbstractVector; kwargs...)
    z_vals, E_vals = calculate_field(T, [freq], distances; kwargs...)
    return z_vals, E_vals[:, 1]
end

"""
   plot_field(z_vals::AbstractVector{<:Real}, E_vals::AbstractVector{<:Complex}, distances::AbstractVector{<:Real}; mirror::Real=-2e-3, thickness::Real=1e-3, title::String="")
   
Plot the resulting field in given 1D MADMAX disc configuration. Both axes are dimensionles

# Arguments
- `z_vals::AbstractVector{<:Real}`: 1D Position array. expects to be same size as E_vals
- `E_vals::AbstractVector{<:Complex}`: 1D E field array, consists of complex values of E field for each position
- `distances::AbstractVector{<:Real}`: distances between discs. Needed to plot vacuum and disc areas
- `mirror::Real=-2e-3`: Length of mirror in final plot (in mm)
- `thickness::Real=1e-3`: thickness of every disc (in mm).
- `title::String`: Title of the plot.

# Returns
- `p`: the plot

# Examples
Plot the plane wave solution of an externally induced 1D MADMAX setup
```jldoctest
julia> freq_range = 22e9:1e6:22.02e9

julia> distance = [1, 2, 3, 4] * 1e-3

julia> z_vals, E_matrix_plane = calculate_field(PlaneWave, freq_range, distance)

julia> p = plot_field(z_vals, E_plane_plot, distance; title="Plane Wave @ \$(freq2plot / 1e9) GHz")
"""
function plot_field(z_vals::AbstractVector{<:Real}, E_vals::AbstractVector{<:Complex}, distances::AbstractVector{<:Real}; mirror::Real=-2e-3, thickness::Real=1e-3, title::String="")

    # initalize empty figure
    p = plot(xlabel="z/m", ylabel="E/E0", title=title, legend=:best)
    
    # add mirror on the left side
    vspan!(p, [mirror, 0.0], color=:blue, alpha=0.5, label="Spiegel", linceolor=:transparent)

    # iterate for every disc and add the discs as vertical bars
    current_z_plot = 0.0
    for i in eachindex(distances)
        current_z_plot += distances[i]
        disk_start = current_z_plot
        disk_end = current_z_plot + thickness

        lbl = i ==1 ? "Disk" : ""
        vspan!(p, [disk_start, disk_end], color=:gray, alpha=0.3, label=lbl, linecolor=:transparent)

        current_z_plot += thickness
    end

    # add the E field
    plot!(p, z_vals, real(E_vals), label="Re(E)", color=:blue)
    plot!(p, z_vals, imag(E_vals), label="Im(E)", color=:red)
    display(p)

    return p
end

## Testaufrufe ##

# Test für ebene Welle:
freq_range = 22e9:1e6:22.02e9
z_vals, E_matrix_plane = calculate_field(PlaneWave, freq_range, distance)

target_idx = 6
freq2plot = freq_range[target_idx]
E_target_plane = E_matrix_plane[:, target_idx]

ang = angle(E_target_plane[end])
E_plane_plot = E_target_plane .* exp(-1im * ang)

plot_field(z_vals, E_plane_plot, distance; title="Plane Wave @ $(freq2plot / 1e9) GHz")

## Test mit Axion
z_vals, E_matrix = calculate_field(WithAxion, freq_range, distance)

E_target_axion = E_matrix[:, target_idx]

E_axion_plot = E_target_axion .* exp(-1im * pi / 2 * 0.95)

plot_field(z_vals, E_axion_plot, distance; title="Axion Signal @ $(freq2plot / 1e9) GHz");