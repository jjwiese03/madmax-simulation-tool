---
layout: default
title: Startseite
---

# Introduction

In this tutorial, you will learn how to start the application and get an overview of its main features.

# Getting Started

You can either use the online version of the application or run it locally.

To use the online version, open the following page in your browser:

<https://jjwiese03.github.io/madmax-simulation-tool/frontend/#tab-Position>

To run the application locally, first clone the GitHub repository:

```bash
git clone https://github.com/jjwiese03/madmax-simulation-tool.git
```

Next, navigate to the `backend` directory, start a Julia session, and execute the startup script:

```julia
cd("backend")
include("startup.jl")
```

Once the server has started, open the following address in your web browser:

<http://localhost:8000/frontend>

> **Note:** The online version provides only the core functionality of the application, including the calculation of the boost factor and reflectivity. To access the complete feature set, the application must be run locally.

# Features
