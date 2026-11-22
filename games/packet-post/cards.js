/* Field Cards earned in Packet Post (g09). */
RQ.defineCards("g09", [
  { id: "tcp-handshake", name: "TCP handshake", icon: "🤝", cat: "network",
    text: "Before **TCP** sends data, two computers shake hands: **SYN** (\"Can we talk?\"), **SYN-ACK** (\"Yes! Can you hear me?\") and **ACK** (\"Yes, I hear you!\").",
    reseed: "Your browser shakes hands like this before it talks to `python -m reseed serve` on port 8000 (`reseed/server.py`)." },
  { id: "packet", name: "Packets and routers", icon: "📦", cat: "network",
    text: "Big files travel as many small **packets**, each with an address label. **Routers** pass them along like post offices, and packets may take different roads.",
    reseed: "A photo you upload to `/api/classify` travels as packets. The server turns away uploads over 12 MB (`MAX_UPLOAD` in `reseed/server.py`)." },
  { id: "tcp", name: "TCP: nothing goes missing", icon: "🔢", cat: "network",
    text: "While the connection works, **TCP** keeps track of the data, resends missing parts and puts everything back in order. Resends take a little time. (Game version: we number whole packets; real TCP counts bytes.)",
    reseed: "`python -m reseed serve` speaks HTTP over TCP, so an uploaded photo reaches ForestNet complete and in order (`reseed/server.py`)." },
  { id: "udp", name: "UDP: fast, no promises", icon: "📹", cat: "network",
    text: "**UDP** sends packets with no handshake and no resends of its own, and they may arrive mixed up. Live video often uses it: the app patches (**conceals**) or skips a damaged picture, called a **frame**. Some apps ask for a resend if there is time.",
    reseed: "The demo flight script talks to a drone (or a simulator) over UDP, for example `--connect udp:127.0.0.1:14550` (`reseed/demo_flight.py`)." },
  { id: "dns", name: "IP address and DNS", icon: "📒", cat: "network",
    text: "Packets travel to an **IP address**. Older IPv4 addresses are four numbers like `185.199.108.153`; newer IPv6 addresses are longer, with letters and colons. **DNS** is the phone book that turns a name into an address, and your computer remembers recent answers (a **cache**). (Game version: real DNS asks a chain of servers.)",
    reseed: "The ReSeed website lives at `khamydoan.github.io/reseed` (README). The demo server uses `localhost` = `127.0.0.1`, your own computer (`reseed/server.py`)." },
  { id: "port", name: "Ports", icon: "🚪", cat: "network",
    text: "One computer has 65,535 numbered doors called **ports**. Usually **443** = HTTPS websites, **80** = plain HTTP, **22** = SSH remote control. A URL can name the door: `localhost:8000`.",
    reseed: "`python -m reseed serve` waits at door **8000**: try `http://localhost:8000/api/health` (`reseed/__main__.py`, `reseed/server.py`)." }
]);
