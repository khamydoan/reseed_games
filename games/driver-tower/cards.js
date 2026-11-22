/* Field Cards earned in Driver Tower (g04). */
RQ.defineCards("g04", [
  { id: "gpu-driver", name: "GPU driver", icon: "🟩", cat: "hardware",
    text: "The **driver** is the translator between programs and the GPU. CUDA and driver versions must fit together. (game version: a CUDA block can't be newer than the driver's tag)",
    reseed: "Our project computer, where ReSeed was built, runs NVIDIA driver **570.211.01**; its report says CUDA 12.8. `reseed/classify/train.py` needs a driver to reach the GPUs." },
  { id: "torch-wheel", name: "PyTorch wheel", icon: "🎡", cat: "ai",
    text: "`pip install torch` downloads a **wheel**, a ready-made package. On Linux, the GPU version also pulls in helper packages with the CUDA runtime and cuDNN, so you only install the driver yourself. (game version: we show one matching set)",
    reseed: "`environment.yml` installs `torch` with pip. In our project computer's `reseed` environment that is torch 2.6.0+cu124, plus pip packages `nvidia-cuda-runtime-cu12` and `nvidia-cudnn-cu12`. No CUDA toolkit is installed." },
  { id: "cuda-toolkit", name: "CUDA toolkit", icon: "🧰", cat: "hardware",
    text: "**CUDA** lets a program hand thousands of small jobs to the GPU at once. The **toolkit** adds `nvcc`, the compiler experts use to build GPU programs. Its version has to fit the driver.",
    reseed: "ReSeed skips the toolkit: the CUDA 12.4 runtime package that pip brought with torch is enough to train ForestNet (`reseed/classify/train.py`)." },
  { id: "cudnn", name: "cuDNN", icon: "🧠", cat: "ai",
    text: "**cuDNN** is NVIDIA's box of fast tricks for neural networks, like convolutions. Each cuDNN is made for one big CUDA version: 11, 12 or 13.",
    reseed: "ForestNet is built from convolutions (`reseed/classify/model.py`). On our project computer, PyTorch can use cuDNN 9.1 for them: the `nvidia-cudnn-cu12` package pip brought along." },
  { id: "nvidia-smi", name: "nvidia-smi", icon: "📟", cat: "hardware",
    text: "Type `nvidia-smi` to see every NVIDIA GPU: name, memory, how busy it is, and the driver. **CUDA Version** at the top is the newest CUDA the driver supports, not what is installed. (game version: we hid some columns)",
    reseed: "On our project computer it lists 4 × NVIDIA A100 80GB PCIe with 81920 MiB each. 1024 MiB make 1 GiB, so that is 80 GiB each and 320 GiB in total." },
  { id: "torch-cuda-check", name: "torch.cuda.is_available()", icon: "✅", cat: "ai",
    text: "This line asks PyTorch: can I use an NVIDIA GPU? `True` means yes. `torch.cuda.device_count()` counts the GPUs, named `cuda:0`, `cuda:1`…",
    reseed: "`reseed/classify/train.py` picks its device with `torch.device(\"cuda\" if torch.cuda.is_available() else \"cpu\")`. Retraining takes about 12 minutes on one GPU (README)." }
]);
