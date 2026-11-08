import base64
import gc
import io
import os
from collections import OrderedDict
from typing import Any, Dict, List, Optional

import numpy as np
import segmentation_models_pytorch as smp
import timm
import torch
import torch.nn as nn
import torchvision.transforms as T
from fastapi import FastAPI, HTTPException
from huggingface_hub import hf_hub_download
from PIL import Image
from pydantic import BaseModel

app = FastAPI(title="Martian Map Mars-Bench & MOMO Inference Space")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MAX_LOADED_MODELS = 2
MODEL_CACHE: "OrderedDict[str, nn.Module]" = OrderedDict()

DOMARS16K_CLASSES = [
    "Aeolian Curved",
    "Aeolian Straight",
    "Cliff",
    "Crater",
    "Crater Flat",
    "Gullies",
    "Landslide",
    "Mixed Terrain",
    "Mounds",
    "Ridges",
    "Rough Terrain",
    "Slope Streaks",
    "Smooth Regolith",
    "Spiders",
    "Swiss Cheese Terrain",
]

FROST_CLASSES = ["Background (Bare Regolith)", "Seasonal Surface Frost (CO2/H2O)"]


class InferRequest(BaseModel):
    model_id: str
    hf_repo_id: str
    task: str
    image_base64: str
    mime_type: str = "image/jpeg"
    sensor: str = "HiRISE"
    prompt: Optional[str] = None


def strip_lightning_prefix(state_dict: Dict[str, Any]) -> Dict[str, torch.Tensor]:
    if "state_dict" in state_dict and isinstance(state_dict["state_dict"], dict):
        state_dict = state_dict["state_dict"]
    elif "model" in state_dict and isinstance(state_dict["model"], dict):
        state_dict = state_dict["model"]

    cleaned: Dict[str, torch.Tensor] = {}
    for k, v in state_dict.items():
        if not isinstance(v, torch.Tensor):
            continue
        nk = k
        for prefix in ("model.", "backbone.", "net.", "encoder_decoder.", "module."):
            if nk.startswith(prefix):
                nk = nk[len(prefix) :]
        cleaned[nk] = v
    return cleaned


def load_model_cached(model_id: str, hf_repo_id: str) -> nn.Module:
    cache_key = f"{model_id}::{hf_repo_id}"
    if cache_key in MODEL_CACHE:
        MODEL_CACHE.move_to_end(cache_key)
        return MODEL_CACHE[cache_key]

    while len(MODEL_CACHE) >= MAX_LOADED_MODELS:
        _, evicted = MODEL_CACHE.popitem(last=False)
        del evicted
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    token = os.environ.get("HF_TOKEN")

    if model_id == "momo-foundation":
        ckpt_path = hf_hub_download(repo_id=hf_repo_id, filename="vit-b-16/momo.pth", token=token)
        raw_sd = torch.load(ckpt_path, map_location="cpu", weights_only=False)
        sd = strip_lightning_prefix(raw_sd if isinstance(raw_sd, dict) else {})
        net = timm.create_model("vit_base_patch16_224", pretrained=False, num_classes=0)
        net.load_state_dict(sd, strict=False)
    elif model_id == "mars-bench-crater":
        ckpt_path = hf_hub_download(repo_id=hf_repo_id, filename="model.ckpt", token=token)
        raw_sd = torch.load(ckpt_path, map_location="cpu", weights_only=False)
        sd = strip_lightning_prefix(raw_sd if isinstance(raw_sd, dict) else {})
        net = smp.Unet(encoder_name="resnet34", encoder_weights=None, in_channels=3, classes=1)
        net.load_state_dict(sd, strict=False)
    elif model_id == "mars-bench-boulder":
        ckpt_path = hf_hub_download(repo_id=hf_repo_id, filename="model.ckpt", token=token)
        raw_sd = torch.load(ckpt_path, map_location="cpu", weights_only=False)
        sd = strip_lightning_prefix(raw_sd if isinstance(raw_sd, dict) else {})
        # Support segmentation-connected-component boulder localization or FasterRCNN checkpoints
        net = smp.Unet(encoder_name="resnet34", encoder_weights=None, in_channels=3, classes=1)
        net.load_state_dict(sd, strict=False)
    elif model_id in ("mars-bench-geology", "mars-bench-frost"):
        ckpt_path = hf_hub_download(repo_id=hf_repo_id, filename="model.ckpt", token=token)
        raw_sd = torch.load(ckpt_path, map_location="cpu", weights_only=False)
        sd = strip_lightning_prefix(raw_sd if isinstance(raw_sd, dict) else {})
        num_cls = 15 if model_id == "mars-bench-geology" else 2
        net = timm.create_model("resnet50", pretrained=False, num_classes=num_cls)
        net.load_state_dict(sd, strict=False)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported Space model_id: {model_id}")

    net.to(DEVICE)
    net.eval()
    MODEL_CACHE[cache_key] = net
    return net


def mask_to_base64_png(binary_mask: np.ndarray) -> str:
    img = Image.fromarray((binary_mask.astype(np.uint8) * 255), mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "device": str(DEVICE),
        "loaded_models": list(MODEL_CACHE.keys()),
    }


@app.post("/infer")
@torch.inference_mode()
def infer(req: InferRequest) -> Dict[str, Any]:
    try:
        raw_bytes = base64.b64decode(req.image_base64)
        pil_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image payload: {exc}")

    orig_w, orig_h = pil_img.size
    net = load_model_cached(req.model_id, req.hf_repo_id)

    if req.model_id == "momo-foundation":
        tfm = T.Compose([
            T.Resize((224, 224)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        x = tfm(pil_img).unsqueeze(0).to(DEVICE)
        feat = net(x).squeeze(0).detach().cpu().numpy().tolist()
        return {"provider": "hf-space-pytorch", "embedding": feat}

    if req.model_id == "mars-bench-crater":
        tfm = T.Compose([
            T.Resize((512, 512)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        x = tfm(pil_img).unsqueeze(0).to(DEVICE)
        logits = net(x)
        probs = torch.sigmoid(logits).squeeze().detach().cpu().numpy()
        binary = (probs > 0.5)
        score = float(probs[binary].mean()) if binary.any() else float(probs.max())
        resized_mask = np.array(
            Image.fromarray((binary.astype(np.uint8) * 255)).resize((orig_w, orig_h), Image.NEAREST)
        ) > 127
        return {
            "provider": "hf-space-pytorch",
            "masks": [
                {
                    "label": "Martian Impact Crater",
                    "score": round(score, 4),
                    "mask": mask_to_base64_png(resized_mask),
                }
            ],
        }

    if req.model_id == "mars-bench-boulder":
        tfm = T.Compose([
            T.Resize((512, 512)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        x = tfm(pil_img).unsqueeze(0).to(DEVICE)
        probs = torch.sigmoid(net(x)).squeeze().detach().cpu().numpy()
        binary = probs > 0.55
        boxes: List[Dict[str, Any]] = []
        # Grid patch peak extraction into bounding boxes in original pixel coordinates
        patch = 32
        for gy in range(0, 512, patch):
            for gx in range(0, 512, patch):
                sub = probs[gy : gy + patch, gx : gx + patch]
                if sub.max() > 0.60 and (binary[gy : gy + patch, gx : gx + patch].mean() > 0.08):
                    ys, xs = np.where(sub > 0.55)
                    if len(xs) == 0:
                        continue
                    xmin = int(((gx + xs.min()) / 512.0) * orig_w)
                    xmax = int(((gx + xs.max() + 1) / 512.0) * orig_w)
                    ymin = int(((gy + ys.min()) / 512.0) * orig_h)
                    ymax = int(((gy + ys.max() + 1) / 512.0) * orig_h)
                    boxes.append({
                        "label": "Martian Boulder",
                        "score": round(float(sub.max()), 4),
                        "box": {"xmin": xmin, "ymin": ymin, "xmax": max(xmin + 4, xmax), "ymax": max(ymin + 4, ymax)},
                    })
        boxes.sort(key=lambda b: b["score"], reverse=True)
        return {"provider": "hf-space-pytorch", "boxes": boxes[:25]}

    if req.model_id in ("mars-bench-geology", "mars-bench-frost"):
        tfm = T.Compose([
            T.Resize((224, 224)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        x = tfm(pil_img).unsqueeze(0).to(DEVICE)
        probs = torch.softmax(net(x), dim=-1).squeeze(0).detach().cpu().numpy()
        labels = DOMARS16K_CLASSES if req.model_id == "mars-bench-geology" else FROST_CLASSES
        out = [
            {"label": labels[i] if i < len(labels) else f"Class_{i}", "score": round(float(p), 5)}
            for i, p in enumerate(probs)
        ]
        out.sort(key=lambda item: item["score"], reverse=True)
        return {"provider": "hf-space-pytorch", "classifications": out[:6]}

    raise HTTPException(status_code=400, detail="Unhandled task")
