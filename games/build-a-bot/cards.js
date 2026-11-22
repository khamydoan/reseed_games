/* Field Cards earned in Mo's Workshop (g02). */
RQ.defineCards("g02", [
  { id: "motherboard", name: "Motherboard", icon: "🧩", cat: "hardware",
    text: "The **motherboard** is the big board that links the computer's parts. The **PSU** supplies power, and at switch-on a quick self-test (**POST**) checks the basics.",
    reseed: "Every ReSeed step, from `reseed/acquire.py` to `reseed/mission.py`, runs on parts plugged into a motherboard." },
  { id: "cpu-chef", name: "CPU (processor)", icon: "👨‍🍳", cat: "hardware",
    text: "The **CPU** is the head chef: it follows instructions step by step and makes tricky decisions. Its **cores** are like a few chefs side by side.",
    reseed: "`reseed/detect.py` makes ReSeed's if/elif choices (lost forest, or just winter?) on the CPU." },
  { id: "ram-countertop", name: "RAM (memory)", icon: "🍳", cat: "hardware",
    text: "**RAM** is the countertop: very fast space for whatever you are working on right now. When the power goes off, it is wiped clean.",
    reseed: "While `reseed/ndvi.py` computes greenness, the satellite pictures sit in RAM as numpy arrays." },
  { id: "storage-pantry", name: "SSD and HDD (storage)", icon: "🗄️", cat: "hardware",
    text: "**Storage** is the pantry: it keeps files with the power off. An **SSD** is fast; an **HDD** is big and cheap but slower, because its disk spins.",
    reseed: "Trained ForestNet is saved as a file, `models/forestnet.pt` (README), so it is still there tomorrow." },
  { id: "gpu-helpers", name: "GPU (graphics card)", icon: "🎨", cat: "hardware",
    text: "A **GPU** has thousands of small cores working in big teams. They shine when many things need the same math: pixels, or neural-network math. The race clock was an example (game version).",
    reseed: "`reseed/classify/train.py` picks a CUDA GPU when there is one (`torch.cuda.is_available()`); the README says retraining takes about 12 minutes on one GPU." },
  { id: "spec-sheet", name: "Spec sheet", icon: "📋", cat: "hardware",
    text: "A **spec sheet** lists a computer's parts and sizes. **4 × 80 GB** means four GPUs sold as 80 GB each: 320 GB in total.",
    reseed: "Our project computer, where ReSeed was built: Ubuntu 24.04 LTS, 96 CPU cores, 866 GB RAM, 4 × NVIDIA A100 80 GB." }
]);
