---
layout: default
title: Startseite
---

# Introduction 
In diesem Tutorial Starten wir die App und geben wir einen Überblick über die haupfunktionen. 
# Get Started
Zunächst öffne entweder die online Version der App unter folgendem [link](https://jjwiese03.github.io/madmax-simulation-tool/frontend/#tab-Position), oder starte die App lokal. Dazu clone das [Github Repo](https://github.com/jjwiese03/madmax-simulation-tool.git) mit folgendem Befehl im Terminal:
```
git clone https://github.com/jjwiese03/madmax-simulation-tool.git
``` 
Navigiere nun von da aus in den `backend`- Ordner und starte dort mit Julia die das startscript `startup.jl`

```julia
cd backend
julia 
include("startup.jl")
``` 
öffne nun im Browser den lokalhost [http://localhost:8000/frontend](http://localhost:8000/frontend).
>Wichtig!!! Die Online Version der App enthält nur Grundlegende Features, wie Berechnung des Boostfaktors und der Reflektivität. Damit die App vollumfänglich genutzt werden kann muss sie lokal gestartet werden. 
# Funktionen
