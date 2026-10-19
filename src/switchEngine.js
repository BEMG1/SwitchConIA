// Cisco IOS Switch Engine & Command Parser Simulator
export class SwitchEngine {
  constructor(initialState = {}) {
    this.reset(initialState);
  }

  reset(initialState = {}) {
    this.promptMode = "user"; // "user" (>), "privileged" (#), "config" (config#), "config-if" (config-if#), "config-vlan" (config-vlan#), "config-range" (config-if-range#)
    this.currentContext = {}; // { ifaces: [], vlanId: null }
    this.history = [];
    this.historyIndex = -1;
    
    // Deep clone state
    this.state = JSON.parse(JSON.stringify({
      hostname: initialState.hostname || "Switch",
      ipRouting: initialState.ipRouting || false,
      ipv6Routing: initialState.ipv6Routing || false,
      vlans: initialState.vlans || {
        "1": { name: "default", ports: ["Fa0/1", "Fa0/2", "Gi0/1", "Gi0/2"] }
      },
      interfaces: initialState.interfaces || {
        "Fa0/1": { mode: "access", vlan: 1, status: "up" },
        "Fa0/2": { mode: "access", vlan: 1, status: "up" },
        "Gi0/1": { mode: "access", vlan: 1, status: "up" },
        "Gi0/2": { mode: "access", vlan: 1, status: "up" }
      },
      svi: initialState.svi || {},
      stpVlanPriorities: initialState.stpVlanPriorities || { "1": 32768 },
      spanningTree: initialState.spanningTree || { mode: "pvst", priority: 32768 },
      syslogErrors: initialState.syslogErrors || []
    }));
  }

  getPrompt() {
    const host = this.state.hostname;
    switch (this.promptMode) {
      case "user":
        return `${host}>`;
      case "privileged":
        return `${host}#`;
      case "config":
        return `${host}(config)#`;
      case "config-if":
        return `${host}(config-if)#`;
      case "config-vlan":
        return `${host}(config-vlan)#`;
      case "config-range":
        return `${host}(config-if-range)#`;
      default:
        return `${host}#`;
    }
  }

  execute(rawCmd) {
    const trimmed = rawCmd.trim();
    if (!trimmed) return "";
    
    // Log history
    this.history.push(rawCmd);
    this.historyIndex = this.history.length;

    // Check for help command
    if (trimmed === "?") {
      return this.getHelp();
    }

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    // Global navigation commands
    if (cmd === "exit") {
      return this.handleExit();
    }
    if (cmd === "end") {
      this.promptMode = "privileged";
      this.currentContext = {};
      return "";
    }
    if (cmd === "clear" || cmd === "cls") {
      return "__CLEAR__";
    }

    // Mode-specific handling
    switch (this.promptMode) {
      case "user":
        return this.handleUserMode(parts, trimmed);
      case "privileged":
        return this.handlePrivilegedMode(parts, trimmed);
      case "config":
        return this.handleConfigMode(parts, trimmed);
      case "config-if":
      case "config-range":
        return this.handleInterfaceMode(parts, trimmed);
      case "config-vlan":
        return this.handleVlanConfigMode(parts, trimmed);
      default:
        return `% Invalid input detected at '^' marker.`;
    }
  }

  handleExit() {
    if (this.promptMode === "config-if" || this.promptMode === "config-range" || this.promptMode === "config-vlan") {
      this.promptMode = "config";
      this.currentContext = {};
      return "";
    }
    if (this.promptMode === "config") {
      this.promptMode = "privileged";
      return "";
    }
    if (this.promptMode === "privileged") {
      this.promptMode = "user";
      return "";
    }
    return "% Conexión de consola activa.";
  }

  handleUserMode(parts, raw) {
    const cmd = parts[0].toLowerCase();
    if (cmd === "enable" || cmd === "en") {
      this.promptMode = "privileged";
      return "";
    }
    if (cmd === "show" || cmd === "sh") {
      return this.handleShowCommands(parts.slice(1));
    }
    if (cmd === "ping") {
      return this.handlePing(parts.slice(1));
    }
    return `% Comando no reconocido en modo usuario. Escribe 'enable' para entrar al modo privilegiado o '?' para ayuda.`;
  }

  handlePrivilegedMode(parts, raw) {
    const cmd = parts[0].toLowerCase();
    const arg1 = parts[1] ? parts[1].toLowerCase() : "";

    if (cmd === "disable") {
      this.promptMode = "user";
      return "";
    }
    if (cmd === "configure" || cmd === "conf" || (cmd === "conf" && arg1 === "t") || (cmd === "configure" && arg1 === "terminal")) {
      this.promptMode = "config";
      return "Enter configuration commands, one per line. End with CNTL/Z.";
    }
    if (cmd === "show" || cmd === "sh") {
      return this.handleShowCommands(parts.slice(1));
    }
    if (cmd === "ping") {
      return this.handlePing(parts.slice(1));
    }
    if (cmd === "copy" && arg1 === "running-config") {
      return "Destination filename [startup-config]? \nBuilding configuration...\n[OK]";
    }
    if (cmd === "write" || cmd === "wr") {
      return "Building configuration...\n[OK]";
    }
    return `% Comando desconocido en modo privilegiado. Usa 'configure terminal' o 'show ...'`;
  }

  handleConfigMode(parts, raw) {
    const cmd = parts[0].toLowerCase();
    const arg1 = parts[1] ? parts[1].toLowerCase() : "";

    // hostname
    if (cmd === "hostname") {
      if (parts[1]) {
        this.state.hostname = parts[1];
        return "";
      }
      return "% Incomplete command. Syntax: hostname <name>";
    }

    // ip routing
    if (cmd === "ip" && arg1 === "routing") {
      this.state.ipRouting = true;
      return "";
    }
    if (cmd === "no" && arg1 === "ip" && parts[2]?.toLowerCase() === "routing") {
      this.state.ipRouting = false;
      return "";
    }

    // ipv6 unicast-routing
    if (cmd === "ipv6" && (arg1 === "unicast-routing" || (arg1 === "unicast" && parts[2]?.toLowerCase() === "routing"))) {
      this.state.ipv6Routing = true;
      return "";
    }

    // spanning-tree vlan X priority Y / root primary
    if (cmd === "spanning-tree" || cmd === "spanning") {
      return this.handleSpanningTreeGlobal(parts.slice(1));
    }

    // vlan X
    if (cmd === "vlan" && parts[1]) {
      const vlanId = parts[1];
      if (isNaN(vlanId) || parseInt(vlanId) < 1 || parseInt(vlanId) > 4094) {
        return "% Invalid VLAN id: Must be 1-4094.";
      }
      if (!this.state.vlans[vlanId]) {
        this.state.vlans[vlanId] = { name: `VLAN00${vlanId}`.slice(-7), ports: [] };
      }
      this.promptMode = "config-vlan";
      this.currentContext = { vlanId };
      return "";
    }

    // interface range Fa0/1 - 4
    if (cmd === "interface" && arg1 === "range") {
      const rangeSpec = parts.slice(2).join(" ");
      const ifaces = this.parseInterfaceRange(rangeSpec);
      if (ifaces.length > 0) {
        this.promptMode = "config-range";
        this.currentContext = { ifaces };
        return "";
      }
      return "% Invalid interface range syntax. Example: interface range fa0/1 - 4 or fa0/10 - 24";
    }

    // interface Fa0/1 or FastEthernet 0/1 or GigabitEthernet 0/1 or Vlan 10
    if (cmd === "interface" || cmd === "int") {
      let ifaceName = parts.slice(1).join("");
      if (!ifaceName) return "% Incomplete command.";

      const normalized = this.normalizeInterfaceName(ifaceName);
      if (normalized.startsWith("Vlan")) {
        if (!this.state.svi[normalized]) {
          this.state.svi[normalized] = { ipv4: null, mask: null, ipv6: null, status: "administratively down" };
        }
        this.promptMode = "config-if";
        this.currentContext = { ifaces: [normalized], isSvi: true };
        return "";
      }

      if (this.state.interfaces[normalized]) {
        this.promptMode = "config-if";
        this.currentContext = { ifaces: [normalized], isSvi: false };
        return "";
      } else {
        // Create it dynamically if valid pattern
        if (/^(Fa|Gi)\d+\/\d+$/i.test(normalized)) {
          this.state.interfaces[normalized] = { mode: "access", vlan: 1, status: "up" };
          this.promptMode = "config-if";
          this.currentContext = { ifaces: [normalized], isSvi: false };
          return "";
        }
      }
      return `% Unknown interface: ${parts.slice(1).join(" ")}`;
    }

    // do show ...
    if (cmd === "do") {
      if (arg1 === "show" || arg1 === "sh") {
        return this.handleShowCommands(parts.slice(2));
      }
      if (arg1 === "ping") {
        return this.handlePing(parts.slice(2));
      }
    }

    return `% Unrecognized command in global config. Type '?' for options.`;
  }

  handleVlanConfigMode(parts, raw) {
    const cmd = parts[0].toLowerCase();
    const vlanId = this.currentContext.vlanId;

    if (cmd === "name" && parts[1]) {
      const name = parts.slice(1).join(" ");
      if (this.state.vlans[vlanId]) {
        this.state.vlans[vlanId].name = name;
        return "";
      }
    }
    return `% Invalid VLAN sub-command. Type 'name <vlan_name>' or 'exit'`;
  }

  handleInterfaceMode(parts, raw) {
    const cmd = parts[0].toLowerCase();
    const arg1 = parts[1] ? parts[1].toLowerCase() : "";
    const ifaces = this.currentContext.ifaces || [];
    const isSvi = this.currentContext.isSvi;

    // shutdown / no shutdown
    if (cmd === "shutdown" || cmd === "shut") {
      ifaces.forEach(name => {
        if (isSvi) {
          if (this.state.svi[name]) this.state.svi[name].status = "administratively down";
        } else if (this.state.interfaces[name]) {
          this.state.interfaces[name].status = "administratively down";
        }
      });
      return "";
    }
    if (cmd === "no" && (arg1 === "shutdown" || arg1 === "shut")) {
      ifaces.forEach(name => {
        if (isSvi) {
          if (this.state.svi[name]) this.state.svi[name].status = "up";
        } else if (this.state.interfaces[name]) {
          this.state.interfaces[name].status = "up";
        }
      });
      return "";
    }

    // description
    if (cmd === "description" || cmd === "desc") {
      const desc = parts.slice(1).join(" ");
      ifaces.forEach(name => {
        if (this.state.interfaces[name]) this.state.interfaces[name].description = desc;
      });
      return "";
    }

    // switchport mode access / trunk
    if (cmd === "switchport" && arg1 === "mode") {
      const mode = parts[2]?.toLowerCase();
      if (mode === "access" || mode === "trunk") {
        ifaces.forEach(name => {
          if (this.state.interfaces[name]) {
            this.state.interfaces[name].mode = mode;
            if (mode === "trunk" && !this.state.interfaces[name].allowedVlans) {
              this.state.interfaces[name].allowedVlans = [1, 10, 20, 30, 99];
            }
          }
        });
        return "";
      }
      return "% Syntax: switchport mode [access | trunk]";
    }

    // switchport access vlan X
    if (cmd === "switchport" && arg1 === "access" && parts[2]?.toLowerCase() === "vlan") {
      const vid = parseInt(parts[3]);
      if (isNaN(vid)) return "% Invalid VLAN ID.";
      ifaces.forEach(name => {
        if (this.state.interfaces[name]) {
          this.state.interfaces[name].vlan = vid;
          this.state.interfaces[name].mode = "access";
        }
      });
      return "";
    }

    // switchport trunk native vlan X
    if (cmd === "switchport" && arg1 === "trunk" && parts[2]?.toLowerCase() === "native" && parts[3]?.toLowerCase() === "vlan") {
      const vid = parseInt(parts[4]);
      if (isNaN(vid)) return "% Invalid Native VLAN ID.";
      ifaces.forEach(name => {
        if (this.state.interfaces[name]) {
          this.state.interfaces[name].nativeVlan = vid;
        }
      });
      return "";
    }

    // switchport trunk allowed vlan [add/remove/all]
    if (cmd === "switchport" && arg1 === "trunk" && parts[2]?.toLowerCase() === "allowed" && parts[3]?.toLowerCase() === "vlan") {
      const vlanListStr = parts.slice(4).join("");
      const vlanIds = this.parseVlanList(vlanListStr);
      ifaces.forEach(name => {
        if (this.state.interfaces[name]) {
          this.state.interfaces[name].allowedVlans = vlanIds;
        }
      });
      return "";
    }

    // ip address X.X.X.X M.M.M.M
    if (cmd === "ip" && arg1 === "address") {
      const ip = parts[2];
      const mask = parts[3];
      if (ip && mask) {
        ifaces.forEach(name => {
          if (isSvi && this.state.svi[name]) {
            this.state.svi[name].ipv4 = ip;
            this.state.svi[name].mask = mask;
          }
        });
        return "";
      }
      return "% Syntax: ip address <IP> <SubnetMask>";
    }

    // ipv6 address X:X::X/64
    if (cmd === "ipv6" && arg1 === "address") {
      const ipv6 = parts[2];
      if (ipv6) {
        ifaces.forEach(name => {
          if (isSvi && this.state.svi[name]) {
            this.state.svi[name].ipv6 = ipv6;
          }
        });
        return "";
      }
      return "% Syntax: ipv6 address <IPv6-Address/Prefix>";
    }

    // spanning-tree portfast
    if (cmd === "spanning-tree" && arg1 === "portfast") {
      ifaces.forEach(name => {
        if (this.state.interfaces[name]) {
          this.state.interfaces[name].portfast = true;
        }
      });
      return "%Warning: portfast should only be enabled on ports connected to a single host. Connecting hubs, concentrators, switches, bridges, etc... to this interface when portfast is enabled, can cause temporary bridging loops. Use with CAUTION";
    }

    // spanning-tree bpduguard enable
    if (cmd === "spanning-tree" && arg1 === "bpduguard" && parts[2]?.toLowerCase() === "enable") {
      ifaces.forEach(name => {
        if (this.state.interfaces[name]) {
          this.state.interfaces[name].bpduguard = true;
        }
      });
      return "";
    }

    // do show ...
    if (cmd === "do") {
      if (arg1 === "show" || arg1 === "sh") {
        return this.handleShowCommands(parts.slice(2));
      }
    }

    return `% Unrecognized interface command. Type 'switchport ...', 'ip address ...', 'shutdown', etc.`;
  }

  handleSpanningTreeGlobal(parts) {
    // spanning-tree vlan 10,20 priority 4096 / root primary / root secondary
    const arg0 = parts[0]?.toLowerCase();
    if (arg0 === "vlan") {
      const vlanStr = parts[1];
      const vlans = this.parseVlanList(vlanStr);
      const action = parts[2]?.toLowerCase();

      if (action === "priority") {
        const priority = parseInt(parts[3]);
        if (isNaN(priority) || priority % 4096 !== 0) {
          return "% Error: Spanning tree priority must be in increments of 4096 (0, 4096, 8192, 12288, 16384, 20480, 24576, 28672, 32768, 61440)";
        }
        vlans.forEach(vid => {
          this.state.stpVlanPriorities[vid] = priority;
        });
        return "";
      }

      if (action === "root") {
        const rootType = parts[3]?.toLowerCase();
        if (rootType === "primary") {
          vlans.forEach(vid => {
            this.state.stpVlanPriorities[vid] = 4096;
          });
          return "";
        }
        if (rootType === "secondary") {
          vlans.forEach(vid => {
            this.state.stpVlanPriorities[vid] = 28672;
          });
          return "";
        }
      }
    }
    return "% Invalid spanning-tree command syntax. Example: spanning-tree vlan 10 priority 4096";
  }

  handleShowCommands(args) {
    const sub = args[0]?.toLowerCase();
    const sub2 = args[1]?.toLowerCase();

    // show vlan brief
    if (sub === "vlan") {
      return this.renderShowVlanBrief();
    }

    // show interfaces trunk
    if (sub === "interfaces" && (sub2 === "trunk" || sub2 === "tr")) {
      return this.renderShowInterfacesTrunk();
    }

    // show interfaces status
    if (sub === "interfaces" && (sub2 === "status" || sub2 === "stat")) {
      return this.renderShowInterfacesStatus();
    }

    // show ip interface brief
    if (sub === "ip" && sub2 === "interface") {
      return this.renderShowIpInterfaceBrief();
    }

    // show ipv6 interface brief
    if (sub === "ipv6" && sub2 === "interface") {
      return this.renderShowIpv6InterfaceBrief();
    }

    // show ip route
    if (sub === "ip" && (sub2 === "route" || sub2 === "ro")) {
      return this.renderShowIpRoute();
    }

    // show spanning-tree
    if (sub === "spanning-tree" || sub === "spanning") {
      return this.renderShowSpanningTree(sub2);
    }

    // show running-config
    if (sub === "running-config" || sub === "run") {
      return this.renderShowRunningConfig();
    }

    // show cdp neighbors
    if (sub === "cdp" && sub2 === "neighbors") {
      return this.renderShowCdpNeighbors();
    }

    return `% Invalid show option. Available: 'show vlan brief', 'show interfaces trunk', 'show interfaces status', 'show ip route', 'show ip interface brief', 'show running-config', 'show spanning-tree'`;
  }

  handlePing(args) {
    const target = args[0];
    if (!target) return "% Incomplete command. Syntax: ping <ip_address>";
    return `Type escape sequence to abort.
Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:
!!!!!
Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`;
  }

  // --- Show Renderers ---
  renderShowVlanBrief() {
    let out = "VLAN Name                             Status    Ports\n";
    out += "---- -------------------------------- --------- -------------------------------\n";
    
    // Sort VLANs numerically
    const sorted = Object.keys(this.state.vlans).sort((a,b) => parseInt(a) - parseInt(b));
    for (const vid of sorted) {
      const v = this.state.vlans[vid];
      // Find ports assigned to this vlan in access mode
      const assignedPorts = Object.keys(this.state.interfaces).filter(p => {
        const iface = this.state.interfaces[p];
        return iface.mode === "access" && iface.vlan === parseInt(vid);
      });
      const vlanPad = vid.padEnd(4);
      const namePad = (v.name || `VLAN${vid}`).padEnd(32);
      const statusPad = "active   ";
      const portsPad = assignedPorts.join(", ");
      out += `${vlanPad} ${namePad} ${statusPad} ${portsPad}\n`;
    }
    return out;
  }

  renderShowInterfacesTrunk() {
    let trunks = Object.keys(this.state.interfaces).filter(p => this.state.interfaces[p].mode === "trunk");
    if (trunks.length === 0) {
      return "% No trunking interfaces configured.";
    }

    let out = "Port        Mode             Encapsulation  Status        Native vlan\n";
    trunks.forEach(p => {
      const iface = this.state.interfaces[p];
      const native = iface.nativeVlan || 1;
      out += `${p.padEnd(11)} on               802.1q         trunking      ${native}\n`;
    });

    out += "\nPort        Vlans allowed on trunk\n";
    trunks.forEach(p => {
      const iface = this.state.interfaces[p];
      const allowed = iface.allowedVlans ? iface.allowedVlans.join(",") : "1-4094";
      out += `${p.padEnd(11)} ${allowed}\n`;
    });

    out += "\nPort        Vlans in spanning tree forwarding state and not pruned\n";
    trunks.forEach(p => {
      const iface = this.state.interfaces[p];
      const allowed = iface.allowedVlans ? iface.allowedVlans.join(",") : "1";
      out += `${p.padEnd(11)} ${allowed}\n`;
    });

    return out;
  }

  renderShowInterfacesStatus() {
    let out = "Port      Name               Status       Vlan       Duplex  Speed Type\n";
    for (const [p, iface] of Object.entries(this.state.interfaces)) {
      const name = (iface.description || "").slice(0, 18).padEnd(18);
      const st = (iface.status || "up").padEnd(12);
      const vlan = iface.mode === "trunk" ? "trunk".padEnd(10) : String(iface.vlan || 1).padEnd(10);
      out += `${p.padEnd(9)} ${name} ${st} ${vlan} a-full  a-100 10/100BaseTX\n`;
    }
    return out;
  }

  renderShowIpInterfaceBrief() {
    let out = "Interface              IP-Address      OK? Method Status                Protocol\n";
    for (const [p, iface] of Object.entries(this.state.interfaces)) {
      out += `${p.padEnd(22)} unassigned      YES unset  ${(iface.status || "up").padEnd(21)} up\n`;
    }
    for (const [sviName, svi] of Object.entries(this.state.svi)) {
      const ip = (svi.ipv4 || "unassigned").padEnd(15);
      const st = (svi.status || "up").padEnd(21);
      out += `${sviName.padEnd(22)} ${ip} YES manual ${st} up\n`;
    }
    return out;
  }

  renderShowIpv6InterfaceBrief() {
    let out = "Interface              IPv6-Address / Link-Local / Status\n";
    out += "---------------------- -----------------------------------------------------\n";
    for (const [sviName, svi] of Object.entries(this.state.svi)) {
      if (svi.ipv6) {
        out += `${sviName.padEnd(22)} ${svi.ipv6} [${svi.status || "up"}]\n`;
        out += `${"".padEnd(22)} FE80::1 (Link-Local)\n`;
      }
    }
    return out;
  }

  renderShowIpRoute() {
    if (!this.state.ipRouting) {
      return "IP routing is disabled. (Enable with 'ip routing')";
    }
    let out = "Codes: C - connected, S - static, R - RIP, O - OSPF, B - BGP\n\n";
    out += "Gateway of last resort is not set\n\n";

    let hasRoutes = false;
    for (const [name, svi] of Object.entries(this.state.svi)) {
      if (svi.ipv4 && svi.status === "up") {
        hasRoutes = true;
        const net = svi.ipv4.substring(0, svi.ipv4.lastIndexOf(".")) + ".0";
        out += `C    ${net}/24 is directly connected, ${name}\n`;
        out += `L    ${svi.ipv4}/32 is directly connected, ${name}\n`;
      }
    }
    if (!hasRoutes) {
      out += "% No active IP routes present.";
    }
    return out;
  }

  renderShowSpanningTree(sub2) {
    let out = "###### Spanning Tree Protocol (Rapid PVST+) ######\n\n";
    for (const [vid, vlan] of Object.entries(this.state.vlans)) {
      const prio = this.state.stpVlanPriorities[vid] || 32768;
      const isRoot = prio <= 24576;
      out += `VLAN00${vid}\n`;
      out += `  Spanning tree enabled protocol rstp\n`;
      out += `  Root ID    Priority    ${prio}\n`;
      out += `             Address     001c.57d8.b800\n`;
      out += isRoot ? `             This bridge is the root\n` : `             Cost        19\n             Port        Gi0/1\n`;
      out += `  Bridge ID  Priority    ${prio}  (priority ${prio} sys-id-ext ${vid})\n`;
      out += `             Address     001c.57d8.b800\n\n`;
      out += `Interface           Role Sts Cost      Prio.Nbr Type\n`;
      out += `------------------- ---- --- --------- -------- --------------------------------\n`;
      Object.keys(this.state.interfaces).slice(0, 4).forEach(portName => {
        const p = this.state.interfaces[portName];
        const role = isRoot ? "Desg" : "Root";
        const extra = p.portfast ? "P2p Edge" : "P2p";
        out += `${portName.padEnd(19)} ${role} FWD 19        128.1    ${extra}\n`;
      });
      out += "\n";
    }
    return out;
  }

  renderShowRunningConfig() {
    let out = `Current configuration : 1582 bytes\n!\nversion 15.2\nno service timestamps\nservice password-encryption\n!\nhostname ${this.state.hostname}\n!\n`;
    if (this.state.ipRouting) out += "ip routing\n";
    if (this.state.ipv6Routing) out += "ipv6 unicast-routing\n";
    out += "!\n";

    for (const [vid, prio] of Object.entries(this.state.stpVlanPriorities)) {
      out += `spanning-tree vlan ${vid} priority ${prio}\n`;
    }
    out += "!\n";

    for (const [vid, v] of Object.entries(this.state.vlans)) {
      if (vid !== "1") {
        out += `vlan ${vid}\n name ${v.name}\n!\n`;
      }
    }

    for (const [p, iface] of Object.entries(this.state.interfaces)) {
      out += `interface ${p}\n`;
      if (iface.description) out += ` description ${iface.description}\n`;
      if (iface.mode === "trunk") {
        out += ` switchport mode trunk\n`;
        if (iface.nativeVlan) out += ` switchport trunk native vlan ${iface.nativeVlan}\n`;
        if (iface.allowedVlans) out += ` switchport trunk allowed vlan ${iface.allowedVlans.join(",")}\n`;
      } else {
        out += ` switchport mode access\n`;
        out += ` switchport access vlan ${iface.vlan || 1}\n`;
      }
      if (iface.portfast) out += ` spanning-tree portfast\n`;
      if (iface.bpduguard) out += ` spanning-tree bpduguard enable\n`;
      if (iface.status === "administratively down") out += ` shutdown\n`;
      out += `!\n`;
    }

    for (const [sviName, svi] of Object.entries(this.state.svi)) {
      out += `interface ${sviName}\n`;
      if (svi.ipv4 && svi.mask) out += ` ip address ${svi.ipv4} ${svi.mask}\n`;
      if (svi.ipv6) out += ` ipv6 address ${svi.ipv6}\n`;
      if (svi.status === "administratively down") out += ` shutdown\n`;
      out += `!\n`;
    }

    out += "end\n";
    return out;
  }

  renderShowCdpNeighbors() {
    return `Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge
                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone

Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID
Switch-Core      Gig 0/1           154             S I    WS-C2960  Gig 0/1
RTR-Gateway-L3   Gig 0/2           178             R S    CISCO2911 Gig 0/0`;
  }

  // --- Helper parsers ---
  normalizeInterfaceName(name) {
    let clean = name.toLowerCase().replace(/\s+/g, "");
    // FastEthernet 0/1, fa0/1, f0/1
    if (clean.startsWith("fastethernet") || clean.startsWith("fa") || clean.startsWith("f0/")) {
      const match = clean.match(/(?:fastethernet|fa|f)(\d+\/\d+)/i);
      if (match) return `Fa${match[1]}`;
    }
    // GigabitEthernet 0/1, gi0/1, g0/1
    if (clean.startsWith("gigabitethernet") || clean.startsWith("gi") || clean.startsWith("g0/")) {
      const match = clean.match(/(?:gigabitethernet|gi|g)(\d+\/\d+)/i);
      if (match) return `Gi${match[1]}`;
    }
    // Vlan 10, vlan10
    if (clean.startsWith("vlan")) {
      const match = clean.match(/vlan(\d+)/i);
      if (match) return `Vlan${match[1]}`;
    }
    return name;
  }

  parseInterfaceRange(rangeSpec) {
    // example: fa0/1 - 4 or fa0/10 - 24
    const match = rangeSpec.match(/(fa|gi)(\d+)\/(\d+)\s*-\s*(\d+)/i);
    if (!match) return [];
    const prefix = match[1].toLowerCase() === "fa" ? "Fa" : "Gi";
    const slot = match[2];
    const start = parseInt(match[3]);
    const end = parseInt(match[4]);
    const list = [];
    for (let i = start; i <= end; i++) {
      list.push(`${prefix}${slot}/${i}`);
    }
    return list;
  }

  parseVlanList(str) {
    const res = [];
    const parts = str.split(",");
    parts.forEach(p => {
      if (p.includes("-")) {
        const [start, end] = p.split("-").map(n => parseInt(n));
        for (let i = start; i <= end; i++) res.push(i);
      } else {
        const val = parseInt(p);
        if (!isNaN(val)) res.push(val);
      }
    });
    return [...new Set(res)];
  }

  getHelp() {
    return `Comandos disponibles según el modo:
- Modo Usuario/Privilegiado:
    enable, disable, configure terminal
    show vlan brief, show interfaces trunk, show interfaces status
    show ip interface brief, show ipv6 interface brief
    show ip route, show spanning-tree, show running-config, show cdp neighbors
    ping <ip>, copy running-config startup-config, write
- Modo Configuración Global (config)#:
    hostname <nombre>
    vlan <id> (ej: vlan 10, vlan 20)
    interface <nombre> (ej: interface fa0/1, interface vlan 10)
    interface range <rango> (ej: interface range fa0/1 - 4, interface range fa0/10 - 24)
    ip routing, ipv6 unicast-routing
    spanning-tree vlan <id> priority <prio>
    spanning-tree vlan <id> root [primary | secondary]
- Modo Interfaz (config-if)# & Rango:
    switchport mode [access | trunk]
    switchport access vlan <id>
    switchport trunk native vlan <id>
    switchport trunk allowed vlan <vlans>
    ip address <ip> <mascara>
    ipv6 address <ip/prefijo>
    spanning-tree portfast
    spanning-tree bpduguard enable
    shutdown / no shutdown
    description <texto>
- Generales:
    exit, end, clear`;
  }
}
