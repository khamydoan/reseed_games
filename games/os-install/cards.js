/* Field Cards earned in Operation Install (g03). */
RQ.defineCards("g03", [
  { id: "bootable-usb", name: "Bootable USB & boot order", icon: "🔌", cat: "os",
    text: "A **bootable USB** stick holds an OS installer (an `.iso` image). Flashing erases the whole stick! Then open the **UEFI** setup and put USB first in the **boot order**.",
    reseed: "Before any ReSeed code can run, its computer needs an operating system. Our project computer, where ReSeed was built, runs **Ubuntu 24.04 LTS**." },
  { id: "operating-system", name: "Operating system", icon: "💿", cat: "os",
    text: "The **operating system** (OS) is the boss program. The computer's startup tools load it, then it shares the CPU, memory and disks with every app. Ubuntu, Windows and RHEL are operating systems.",
    reseed: "ReSeed's test robot runs on `ubuntu-latest` (`.github/workflows/tests.yml`), and our project computer, where ReSeed was built, runs Ubuntu 24.04." },
  { id: "disk-partition", name: "Disk partitions", icon: "🍰", cat: "os",
    text: "A disk can be split into **partitions**, like rooms in a house: a small **EFI** boot room, **/** for the system and **/home** for your files. Erasing is forever, so **back up first**! (game version sizes)",
    reseed: "`python -m reseed run rondonia` writes its results into a folder on disk, `data_cache/rondonia/` (`reseed/pipeline.py`). Leave room for data!" },
  { id: "strong-password", name: "Strong password", icon: "🔐", cat: "os",
    text: "Several random words plus a number or symbol make a long, strong password. `password` and `123456` are the first ones robots try! Never share your real password.",
    reseed: "ReSeed's secret Azure key goes in a private `.env` file that is never committed (`.env.example`). It stays on the laptop; the public website never sees it (README, \"Demo day\")." },
  { id: "sudo-apt", name: "sudo apt update", icon: "🦸", cat: "os",
    text: "`sudo` means **super user do**: run one command with boss powers. Only use it with commands you trust! `sudo apt update` checks for new versions, and `sudo apt upgrade` installs them.",
    reseed: "Ubuntu 24.04 comes with **Python 3.12**, the same version ReSeed's tests use (`python-version: '3.12'` in `tests.yml`)." },
  { id: "package-manager", name: "Package manager", icon: "🚚", cat: "os",
    text: "A **package manager** downloads and installs programs for you. Ubuntu uses **apt**, Red Hat Enterprise Linux (RHEL) uses **dnf**, and Windows has **winget**. Many also have click-and-install app stores.",
    reseed: "ReSeed's test robot installs its Python packages with `pip install numpy rasterio …` on `ubuntu-latest` (`tests.yml`)." }
]);
