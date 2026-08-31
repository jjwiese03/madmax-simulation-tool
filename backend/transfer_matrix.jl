using LinearAlgebra
using StaticArrays

const c0 = 299792458.

abstract type Space end
abstract type Dist <: Space end
abstract type Pos  <: Space end



function transfer_matrix(::Type{Dist},freqs::Union{Real,AbstractVector{<:Real}},
        distances::AbstractVector{<:Real};
        eps::Real=24.0,tand::Real=0.0,thickness::Real=1e-3,nm::Real=1e15)::Matrix{ComplexF64}

    ϵ  = eps*(1.0-1.0im*tand)
    nd = sqrt(ϵ); nm = complex(nm)
    ϵm = nm^2
    A  = 1-1/ϵ
    A0 = 1-1/ϵm

    l = length(freqs)
    RB = Matrix{ComplexF64}(undef,l,2)

    Gd = SMatrix{2,2,ComplexF64}((1+nd)/2,   (1-nd)/2,   (1-nd)/2,   (1+nd)/2)
    Gv = SMatrix{2,2,ComplexF64}((nd+1)/2nd, (nd-1)/2nd, (nd-1)/2nd, (nd+1)/2nd)
    G0 = SMatrix{2,2,ComplexF64}((1+nm)/2,   (1-nm)/2,   (1-nm)/2,   (1+nm)/2)
    T  = MMatrix{2,2,ComplexF64}(undef); copyto!(T,Gd)

    S  = SMatrix{2,2,ComplexF64}( A/2, 0.0im, 0.0im,  A/2)
    S0 = SMatrix{2,2,ComplexF64}(A0/2, 0.0im, 0.0im, A0/2)
    M  = MMatrix{2,2,ComplexF64}(undef); copyto!(M,S)

    W  = MMatrix{2,2,ComplexF64}(undef) # work matrix for multiplication

    @inbounds @views for j in eachindex(freqs)
        pd1 = cispi(-2*freqs[j]*nd*thickness/c0)
        pd2 = cispi(+2*freqs[j]*nd*thickness/c0)
        
        # iterate in reverse order to sum up M in single sweep (thx david)
        for i in Iterators.reverse(eachindex(distances))
            T[:,1] .*= pd1
            T[:,2] .*= pd2 # T = Gd*Pd

            # mul!(W,T,S); M .-= W        # M = Gd*Pd*S_-1
            mul!(M,T,S,-1.,1.)
            mul!(W,T,Gv); copyto!(T,W)  # T *= Gd*Pd*Gv

            T[:,1] .*= cispi(-2*freqs[j]*distances[i]/c0)
            T[:,2] .*= cispi(+2*freqs[j]*distances[i]/c0)   # T = Gd*Pd*Gv*Gd*S_-1

            if i > 1
                # mul!(W,T,S); M .+= W
                mul!(M,T,S,1.,1.)
                mul!(W,T,Gd); copyto!(T,W)
            else
                # mul!(W,T,S0); M .+= W
                mul!(M,T,S0,1.,1.)
                mul!(W,T,G0); copyto!(T,W)
            end
        end
        
        RB[j] = T[1,2]/T[2,2]
        RB[l+j] = M[1,1]+M[1,2]-(M[2,1]+M[2,2])*T[1,2]/T[2,2]

        copyto!(M,S)
        T .= 1.0+0.0im; T[1,1] += nd; T[2,2] += nd; T[2,1] -= nd; T[1,2] -= nd; T .*= 0.5
    end

    return RB
end

transfer_matrix(freqs::Union{Real,AbstractVector{<:Real}},distances::AbstractVector{<:Real};
    eps::Real=24.0,tand::Real=0.0,thickness::Real=1e-3,nm::Real=1e15) =
    transfer_matrix(Dist,freqs,distances; tand=tand,eps=eps,thickness=thickness,nm=nm)




function transfer_matrix(::Type{Pos},freqs::Union{Real,AbstractVector{<:Real}},
        position::AbstractVector{<:Real};
        eps::Real=24.0,tand::Real=0.0,thickness::Real=1e-3,nm::Real=1e15)::Matrix{ComplexF64}

    ϵ  = eps*(1.0-1.0im*tand)
    nd = sqrt(ϵ); nm = complex(nm)
    ϵm = nm^2
    A  = 1-1/ϵ
    A0 = 1-1/ϵm

    l = length(freqs)
    RB = Matrix{ComplexF64}(undef,l,2)

    Gd = SMatrix{2,2,ComplexF64}((1+nd)/2,   (1-nd)/2,   (1-nd)/2,   (1+nd)/2)
    Gv = SMatrix{2,2,ComplexF64}((nd+1)/2nd, (nd-1)/2nd, (nd-1)/2nd, (nd+1)/2nd)
    G0 = SMatrix{2,2,ComplexF64}((1+nm)/2,   (1-nm)/2,   (1-nm)/2,   (1+nm)/2)
    T  = MMatrix{2,2,ComplexF64}(undef); copyto!(T,Gd)

    S  = SMatrix{2,2,ComplexF64}( A/2, 0.0im, 0.0im,  A/2)
    S0 = SMatrix{2,2,ComplexF64}(A0/2, 0.0im, 0.0im, A0/2)
    M  = MMatrix{2,2,ComplexF64}(undef); copyto!(M,S)

    W  = MMatrix{2,2,ComplexF64}(undef) # work matrix for multiplication

    @inbounds @views for j in eachindex(freqs)
        pd1 = cispi(-2*freqs[j]*nd*thickness/c0)
        pd2 = cispi(+2*freqs[j]*nd*thickness/c0)

        # iterate in reverse order to sum up M in single sweep (thx david)
        for i in Iterators.reverse(eachindex(position))
            T[:,1] .*= pd1
            T[:,2] .*= pd2 # T = Gd*Pd

            # mul!(W,T,S); M .-= W        # M = Gd*Pd*S_-1
            mul!(M,T,S,-1.,1.)
            mul!(W,T,Gv); copyto!(T,W)  # T *= Gd*Pd*Gv

            d = position[i]-(i==1 ? 0 : position[i-1]+thickness)
            T[:,1] .*= cispi(-2*freqs[j]*d/c0)
            T[:,2] .*= cispi(+2*freqs[j]*d/c0)   # T = Gd*Pd*Gv*Gd*S_-1

            if i > 1
                # mul!(W,T,S); M .+= W
                mul!(M,T,S,1.,1.)
                mul!(W,T,Gd); copyto!(T,W)
            else
                # mul!(W,T,S0); M .+= W
                mul!(M,T,S0,1.,1.)
                mul!(W,T,G0); copyto!(T,W)
            end
        end
        
        RB[j] = T[1,2]/T[2,2]
        RB[l+j] = M[1,1]+M[1,2]-(M[2,1]+M[2,2])*T[1,2]/T[2,2]

        copyto!(M,S)
        # T .= 1.0+0.0im; T[1,1] += nd; T[2,2] += nd; T[2,1] -= nd; T[1,2] -= nd; T .*= 0.5
        copyto!(T,Gd)
    end

    return RB
end



@doc """
transfer_matrix(::Type{Space},freqs::Union{Real,AbstractVector{<:Real}},
    disc_configuration::AbstractVector{<:Real};
    eps::Real=24.0,tand::Real=0.0,thickness::Real=1e-3,nm::Real=1e15)::Matrix{ComplexF64}

Return matrix containing (complex) reflectivity (first column) and boost (second column) of the
[transfer matrix algorithm](https://arxiv.org/pdf/1612.07057) for a disc system.

Use `Dist, Pos <: Space` to denote whether `disc_configuration` is given in distance space or position space.
Omitting `Space` defaults to distance space.

#Examples
```jldoctest
julia> tm = transfer_matrix(Dist,22e9:0.01e9:22.05e9,[1,2,3,4]*1e-3)
6×2 Matrix{ComplexF64}:
 -0.920801+0.390032im  0.572322-0.116214im
 -0.920395+0.39099im    0.57135-0.116326im
 -0.919987+0.39195im   0.570373-0.116437im
 -0.919576+0.392912im  0.569392-0.116547im
 -0.919163+0.393876im  0.568408-0.116656im
 -0.918749+0.394843im  0.567419-0.116764im

julia> ref = tm[:,1]; boost = abs2.(tm[:,2]);
```
""" transfer_matrix






function transfer_matrix_2port(::Type{Dist},freqs::Union{Real,AbstractVector{<:Real}},
        distances::AbstractVector{<:Real}; eps::Real=24.0,tand::Real=0.0,thickness::Real=1e-3)
    
    RB2 = transfer_matrix(Dist,freqs,vcat(0,distances);
        eps=eps,tand=tand,thickness=thickness,nm=1)
    RB1 = transfer_matrix(Dist,freqs,vcat(0,reverse(distances));
        eps=eps,tand=tand,thickness=thickness,nm=1)

    return [RB2,RB1]
end


transfer_matrix_2port(::Type{Pos},freqs::Union{Real,AbstractVector{<:Real}},
        distances::AbstractVector{<:Real}; eps::Real=24.0,tand::Real=0.0,thickness::Real=1e-3) =
    transfer_matrix_2port(Dist,freqs,pos2dist(distances); eps=eps,tand=tand,thickness=thickness)

transfer_matrix_2port(freqs::Union{Real,AbstractVector{<:Real}},
        distances::AbstractVector{<:Real}; eps::Real=24.0,tand::Real=0.0,thickness::Real=1e-3) =
    transfer_matrix_2port(Dist,freqs,distances; eps=eps,tand=tand,thickness=thickness)

