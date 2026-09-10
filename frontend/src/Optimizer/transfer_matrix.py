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

def Dominiks_annealing_shortened(obj_func, x0, bounds, args, maxiter=100001, rmax=100e-6, T0=100.0, nreset=500, nresetterm=10, progress_callback=None):
    x = np.copy(x0)
    objx = obj_func(x, *args)

    xsol = np.copy(x)
    objsol = objx

    T = float(T0)
    n_dim = len(x)

    bounds_min = np.array([b[0] for b in bounds])
    bounds_max = np.array([b[1] for b in bounds])

    resetcounter = 0
    resetcounterterm = 0
    nfev = 1

    for iter in range(maxiter):

        ## shoved in a progress bar
        if progress_callback is not None and iter % 100 == 0:
            progress_callback(iter, maxiter, resetcounterterm, nresetterm, xsol.tolist(), xsol.tolist())

        T = max(T- (T0 / maxiter), 0.0)

        dx = 2.0 * np.random.rand(n_dim) - 1.0
        norm_dx = np.linalg.norm(dx)
        if norm_dx > 0:
            dx = (rmax * np.random.rand() / norm_dx) * dx

        x_new = x + dx
        x_new = np.clip(x_new, bounds_min, bounds_max)

        obj_new = obj_func(x_new, *args)
        nfev += 1

        if obj_new <= objx or (T > 0 and np.random.rand() <= np.exp((objx - obj_new) / T)):
            np.copyto(x, x_new)
            objx = obj_new

        if obj_new <= objsol:
            np.copyto(xsol, x_new)
            objsol = obj_new
            resetcounter = 0
            resetcounterterm = 0

        else:
            resetcounter += 1

        if nreset > 0 and resetcounter >= nreset:
            np.copyto(x, xsol)
            objx = objsol
            resetcounter = 0
            resetcounterterm += 1

            if nresetterm > 0 and resetcounterterm >= nresetterm:
                break

    return xsol, objsol, iter + 1, nfev

def run_optimize(freq_min, freq_max, initial_distances, thicknesses, eps=24.0, tand=0.0, algorithm="Dominik", progress_callback=None):
    freqs = np.linspace(freq_min, freq_max, 10) # I reduced the range of frequencies according to Dominiks Dragoon.jl
    bounds = [(0.0, 0.02) for _ in initial_distances]

    if algorithm == "differential_evolution":
        max_iter_de = 50
        iter_count = [0]

        def DE_callback(xk, convergence=None):
            iter_count[0] += 1
            if progress_callback is not None:
                progress_callback(iter_count[0], max_iter_de, 0, 0, xk.tolist(), xk.tolist())

        
        res = differential_evolution(
            objective_function,
            bounds=bounds,
            args=(freqs, thicknesses, eps, tand),
            strategy="best1bin",
            maxiter=max_iter_de,
            popsize=10,
            polish=True,
            callback=DE_callback
        )
        final_distances = res.x
        nit = res.nit
        nfev = res.nfev
        msg = res.message

    else:
        final_distances, _, nit, nfev = Dominiks_annealing_shortened(
            objective_function,
            np.array(initial_distances),
            bounds,
            args=(freqs, thicknesses, eps, tand),
            maxiter=100001,
            rmax=100e-6,
            T0=100.0,
            nreset=500,
            nresetterm=10,
            progress_callback=progress_callback
        )
        msg = "Successful optimization (thx Dominik)"

    freqs_eval = np.linspace(freq_min, freq_max, 100)
    positions_final = np.zeros_like(final_distances)
    current_pos = 0.0
    for i in range(len(final_distances)):
        current_pos += final_distances[i]
        positions_final[i] = current_pos
        current_pos += thicknesses[i]

    final_boost = transfer_matrix(freqs_eval, positions_final, thicknesses, eps, tand)
    integral = np.trapz(final_boost, freqs_eval)
    avg_boost = integral / (freq_max - freq_min) if (freq_max > freq_min) else 0.0

    return {
        "distances": final_distances.tolist(),
        "avg_boost": float(avg_boost),
        "nit": int(nit),
        "nfev": int(nfev),
        "message": str(msg)
    }