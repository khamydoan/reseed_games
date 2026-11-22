/* Field Cards earned in Brain Builder (g11). */
RQ.defineCards("g11", [
  { id: "neuron", name: "Neuron", icon: "⚡", cat: "ai",
    text: "A **neuron** multiplies each input by a **weight**, adds a **bias**, and fires if the total is above 0. One neuron draws one straight line. (game version: two inputs)",
    reseed: "ForestNet's forest answer comes from 2 neurons with 96 weights each (`head_forest` in `classify/model.py`)." },
  { id: "convolution", name: "Convolution filter", icon: "🔍", cat: "ai",
    text: "A **filter** is a tiny 3 × 3 grid of numbers. It slides over the picture, multiplies and adds, and makes a new picture that glows where it finds its pattern.",
    reseed: "`classify/model.py`: ForestNet's first layer has **24** filters of 3 × 3 (`conv1`: 3 colours in, 24 pictures out)." },
  { id: "relu-pool", name: "ReLU and pooling", icon: "🗜️", cat: "ai",
    text: "**ReLU** turns every negative number into 0. **Max pooling** keeps the biggest number of each 2 × 2 block, so the picture gets smaller but keeps its glow.",
    reseed: "ForestNet: convolution + BatchNorm + ReLU, then `MaxPool2d(2)`: 64 → 32 → 16 → 8 pixels (`classify/model.py`)." },
  { id: "training", name: "Training and learning rate", icon: "🏋️", cat: "ai",
    text: "**Training** nudges every weight a little to make the **loss** (how wrong the brain is) smaller. The **learning rate** is the size of each nudge. Too big = wobbly chaos!",
    reseed: "`classify/train.py` uses `torch.optim.AdamW` with a `OneCycleLR` schedule: the learning rate rises, then falls." },
  { id: "train-test", name: "Train / test split", icon: "🔒", cat: "data",
    text: "Keep some pictures hidden during training. **Testing** on those unseen pictures shows if the brain really learned, or only memorised. More kinds of pictures = fewer surprises.",
    reseed: "README validation table: 99.1 % forest accuracy on 5,400 EuroSAT tiles it never trained on, but 88.2 % on the tricky lawns, parks and fields set." },
  { id: "forestnet-arch", name: "ForestNet's layers", icon: "🧠", cat: "ai",
    text: "ForestNet has 4 pattern-finding blocks with 24, 48, 96, then 160 filters. It averages their pictures, uses 96 more neurons and gives a forest answer: about **214,000** learned numbers.",
    reseed: "`classify/model.py`: 214,212 parameters, BatchNorm in every conv block. `train.py` splits give about 57,000 training pictures; README: about 12 minutes on one GPU." }
]);
