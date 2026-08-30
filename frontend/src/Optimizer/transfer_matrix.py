import numpy as np
from scipy.optimize import differential_evolution, dual_annealing

c0 = 299792458.0

def transfer_matrix(freqs, positions, thicknesses, eps=24.0, tand=0.0, nm=1e15):

    N = len(positions)
    l = len(freqs)

    eps_complex = eps - 1j * (eps * tand)
    nd = np.sqrt(eps_complex)
    nm_complex = nm + 0j

    invEps = 1.0 / eps_complex
    invEpsm = 1.0 / (nm_complex**2)

    A = 1.0 - invEps
    A0 = 1.0 - invEpsm

    Gd = np.array([[ (1+nd)/2, (1-nd)/2 ],
                   [ (1-nd)/2, (1+nd)/2 ]], dtype=complex)
    
    Gv = np.array([[ (nd+1)/(2*nd), (nd-1)/(2*nd) ],
                   [ (nd-1)/(2*nd), (nd+1)/(2*nd) ]], dtype=complex)
                   
    G0 = np.array([[ (1+nm_complex)/2, (1-nm_complex)/2 ],
                   [ (1-nm_complex)/2, (1+nm_complex)/2 ]], dtype=complex)
                   
    S = np.array([[ A/2, 0 ], [ 0, A/2 ]], dtype=complex)
    S0 = np.array([[ A0/2, 0 ], [ 0, A0/2 ]], dtype=complex)

    T = np.zeros((2, 2, l), dtype=complex)
    M = np.zeros((2, 2, l), dtype=complex)

    for i in range(2):
        for j in range(2):
            T[i, j, :] = Gd[i, j]
            M[i, j, :] = S[i, j]

    for i in range(N-1, -1, -1):
        ph_d = -2 * np.pi * freqs * nd * thicknesses[i] / c0
        pd = np.exp(1j * ph_d)

        T[0, 0, :] *= pd
        T[1, 0, :] *= pd
        T[0, 1, :] *= np.conj(pd)
        T[1, 1, :] *= np.conj(pd)

        M = M - np.einsum("ijk, jl->ilk", T, S)
        T = np.einsum("ijk,jl->ilk", T, Gv)

        prev_pos = 0.0 if i == 0 else positions[i-1] + thicknesses[i-1]
        d = positions[i] - prev_pos

        ph_v = -2 * np.pi * freqs * d / c0
        pp = np.exp(1j * ph_v)

        T[0, 0, :] *= pp
        T[1, 0, :] *= pp
        T[0, 1, :] *= np.conj(pp)
        T[1, 1, :] *= np.conj(pp)

        if i > 0:
            M = M + np.einsum("ijk,jl->ilk", T, S)
            T= np.einsum("ijk,jl->ilk", T, Gd)
        
        else:
            M = M + np.einsum("ijk,jl->ilk", T, S0)
            T = np.einsum("ijk,jl->ilk", T, G0)
        
    R = T[0, 1, :] / T[1, 1, :]
    sumM0 = M[0, 0, :] + M[0, 1, :]
    sumM1 = M[1, 0, :] + M[1, 1, :]
    B = sumM0 - sumM1 * R

    return np.abs(B)**2

def objective_function(distances, freqs, thicknesses, eps=24.0, tand=0.0):
    positions = np.zeros_like(distances)
    current_pos = 0.0
    for i in range(len(distances)):
        current_pos += distances[i]
        positions[i] = current_pos
        current_pos += thicknesses[i]

    boost = transfer_matrix(freqs, positions, thicknesses, eps, tand)
    return -np.trapz(boost, freqs)

def run_optimize(freq_min, freq_max, initial_distances, thicknesses, eps=24.0, tand=0.0, algorithm="differential_evolution"):
    freqs = np.linspace(freq_min, freq_max, 100)
    bounds = [(0.0, 0.05) for _ in initial_distances]

    if algorithm == "differential_evolution":
        res = differential_evolution(
            objective_function,
            bounds=bounds,
            args=(freqs, thicknesses, eps, tand),
            strategy="best1bin",
            maxiter=100,
            popsize=15,
            polish=True
    )

    else:
        res = dual_annealing(
            objective_function,
            bounds=bounds,
            args=(freqs, thicknesses, eps, tand),
            x0=initial_distances,
            maxiter=50
        )

    return {
        "distances": res.x.tolist(),
        "nit": int(res.nit),
        "nfev": int(res.nfev),
        "message": str(res.message)
    }