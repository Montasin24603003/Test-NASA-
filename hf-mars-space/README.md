---
title: Martian Map Mars-Bench & MOMO Inference Server
emoji: 🪐
colorFrom: red
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# Martian Map — Hugging Face Space PyTorch Checkpoint Server

Why this Space exists:
Five Mars-specific academic repositories (`Mirali33/MOMO` and `Mirali33/mars-bench-*`) publish raw PyTorch `.pth` and PyTorch Lightning `model.ckpt` state dictionaries without Hugging Face `transformers` `config.json` pipelines. Because Hugging Face Serverless Inference Providers (`router.huggingface.co/hf-inference`) only auto-serve supported `transformers` / `diffusers` repositories, raw `.pth` / `.ckpt` models must be served via a **Hugging Face Space** or **Dedicated Inference Endpoint**.

## Deploy in 2 Minutes

1. Create a new Space on Hugging Face (`SDK: Docker`, `CPU basic` free tier or `T4 small`).
2. Upload the files in this `hf-mars-space/` folder (`Dockerfile`, `requirements.txt`, `app.py`, `README.md`).
3. Once the Space status shows `Running`, copy its direct `.hf.space` host URL (e.g. `https://your-username-mars-ai-hub.hf.space`).
4. Set `HF_SPACE_URL=https://your-username-mars-ai-hub.hf.space` and `HF_TOKEN=hf_...` in your website's `.env` / Vercel Environment Variables!
